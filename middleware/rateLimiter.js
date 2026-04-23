// backend/middleware/rateLimiter.js
'use strict';

const rateLimit = require('express-rate-limit');

// ── Shared limiter factory ────────────────────────────────────────────────────
const makeLimiter = (windowMinutes, max, message) =>
    rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max,
        standardHeaders: true,
        legacyHeaders:   false,
        message: { success: false, message },
    });

// ── Limiters ──────────────────────────────────────────────────────────────────

/** Global: 500 requests per 15 minutes */
const globalLimiter = makeLimiter(15, 500, 'Too many requests. Please slow down.');

/** Auth endpoints: 10 attempts per 15 minutes */
const authLimiter = makeLimiter(15, 10, 'Too many login attempts. Please try again in 15 minutes.');

/** OTP endpoints: 5 attempts per 10 minutes */
const otpLimiter = makeLimiter(10, 5, 'Too many OTP requests. Please wait before trying again.');

/** Payment endpoints: 20 requests per 10 minutes */
const paymentLimiter = makeLimiter(10, 20, 'Too many payment requests. Please slow down.');

/** Search endpoints: 60 requests per minute */
const searchLimiter = makeLimiter(1, 60, 'Search rate limit exceeded. Please wait a moment.');

module.exports = { globalLimiter, authLimiter, otpLimiter, paymentLimiter, searchLimiter };
