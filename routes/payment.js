// backend/routes/payment.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect }       = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { adminOnly }     = require('../middleware/roleMiddleware');
const {
    initiatePayment,
    verifyPayment,
    webhook,
    refund,
} = require('../controllers/paymentController');

// Webhook — no auth (Razorpay calls this directly), raw body (configured in server.js)
router.post('/webhook', webhook);

// Protected user routes
router.post('/initiate', protect, paymentLimiter, initiatePayment);
router.post('/verify',   protect, paymentLimiter, verifyPayment);

// Refund — accessible by both user (own order) and admin
router.post('/refund',   protect, refund);

module.exports = router;
