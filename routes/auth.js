const express = require('express');
const router = express.Router();
const { signup, verifyOTP, login, logout, getMe, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/signup', authLimiter, signup);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;
