// backend/routes/auth.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect }      = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const {
    register,
    verifyOTP,
    login,
    refreshToken,
    getMe,
    logout,
    forgotPassword,
    resetPassword,
    clerkSync,
} = require('../controllers/authController');

// Public
router.post('/register',       authLimiter, register);
router.post('/verify-otp',     otpLimiter,  verifyOTP);
router.post('/login',          authLimiter, login);
router.post('/refresh-token',               refreshToken);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password',              resetPassword);
router.post('/clerk-sync',                  clerkSync);

// Protected
router.get('/me',   protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
