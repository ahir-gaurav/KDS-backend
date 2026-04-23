// backend/server.js
'use strict';

const { validateEnv } = require('./config/env');
validateEnv(); // Fail fast on missing required env vars

require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const cookieParser   = require('cookie-parser');
const mongoSanitize  = require('express-mongo-sanitize');
const sanitizeHtml   = require('sanitize-html');

// Custom XSS sanitiser middleware (replaces deprecated xss-clean)
const xssSanitize = (req, _res, next) => {
    const sanitize = (val) => {
        if (typeof val === 'string') return sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} });
        if (typeof val === 'object' && val !== null) {
            for (const key of Object.keys(val)) val[key] = sanitize(val[key]);
        }
        return val;
    };
    if (req.body)   req.body   = sanitize(req.body);
    if (req.query)  req.query  = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);
    next();
};

const connectDB            = require('./config/db');
const { globalLimiter }    = require('./middleware/rateLimiter');
const requestLogger        = require('./middleware/requestLogger');
const errorHandler         = require('./middleware/errorHandler');

// ── Route imports ────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const productRoutes  = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const orderRoutes    = require('./routes/orders');
const cartRoutes     = require('./routes/cart');
const paymentRoutes  = require('./routes/payment');
const reviewRoutes   = require('./routes/reviews');
const userRoutes     = require('./routes/user');
const adminRoutes    = require('./routes/admin');
const couponRoutes   = require('./routes/coupons');

// Public admin controller routes (hero/ticker/settings)
const { getHero, getTicker, getSettings } = require('./controllers/adminController');

const { startCronJobs } = require('./services/cron');

const app = express();

// ── Database ─────────────────────────────────────────────────────────────────
connectDB();

// ── Trust proxy (Render / Railway / Vercel) ───────────────────────────────────
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
    process.env.FRONTEND_URL_2,
].filter(Boolean);

console.log('✅ CORS Allowed Origins:', allowedOrigins);

const corsOptions = {
    origin(origin, cb) {
        if (!origin) return cb(null, true); // Postman / curl
        if (allowedOrigins.includes(origin)) return cb(null, true);
        console.error('🚫 CORS blocked:', origin);
        cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Rate limiting ──────────────────────────────────────────────────────────────
app.use(globalLimiter);

// ── Cookie parser ─────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── Body parsers (raw for webhook FIRST, then JSON) ───────────────────────────
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Sanitisation ──────────────────────────────────────────────────────────────
app.use(mongoSanitize());   // Strip $ and . from req.body/params/query
app.use(xssSanitize);       // Sanitise user-supplied HTML (strips all tags)

// ── Request logger ────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.json({ status: 'ok', time: new Date().toISOString() })
);

// ── Public data endpoints ─────────────────────────────────────────────────────
app.get('/api/hero',     getHero);
app.get('/api/ticker',   getTicker);
app.get('/api/settings', getSettings);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/cart',       cartRoutes);
app.use('/api/payment',    paymentRoutes);
app.use('/api/reviews',    reviewRoutes);
app.use('/api/user',       userRoutes);
app.use('/api/coupons',    couponRoutes);
app.use('/api/admin',      adminRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Global error handler (MUST be last) ───────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    startCronJobs();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received — shutting down gracefully');
    server.close(() => process.exit(0));
});

module.exports = app;
