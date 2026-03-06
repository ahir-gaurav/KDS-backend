require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { startCronJobs } = require('./services/cron');

// Route imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payment');
const couponRoutes = require('./routes/coupons');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

// Public admin controller routes (hero/ticker/settings from admin controller)
const {
    getHero,
    getTicker,
    getSettings,
} = require('./controllers/adminController');

const app = express();

// Connect DB
connectDB();

// Trust proxy (for rate limiting behind Render/Railway)
app.set('trust proxy', 1);

// CORS
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:3001',
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Security
app.use(helmet());

// Rate limiting (global)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

// Cookie parser
app.use(cookieParser());

// Body parsers (raw for webhook, json for everything else)
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Public data routes (hero, ticker, settings)
app.get('/api/hero', getHero);
app.get('/api/ticker', getTicker);
app.get('/api/settings', getSettings);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    startCronJobs();
});

module.exports = app;
