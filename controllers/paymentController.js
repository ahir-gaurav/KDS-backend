// backend/controllers/paymentController.js
'use strict';

const asyncCatch    = require('../utils/asyncCatch');
const AppError      = require('../utils/AppError');
const paymentService = require('../services/paymentService');

// ── POST /api/payment/initiate ────────────────────────────────────────────────
const initiatePayment = asyncCatch(async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) throw new AppError('orderId is required.', 400);

    const data = await paymentService.initiatePayment({ orderId, userId: req.user._id });
    res.status(200).json({ success: true, ...data });
});

// ── POST /api/payment/verify ──────────────────────────────────────────────────
const verifyPayment = asyncCatch(async (req, res) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature)
        throw new AppError('razorpayOrderId, razorpayPaymentId, and razorpaySignature are required.', 400);

    const order = await paymentService.verifyPayment({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        userId: req.user._id,
    });

    res.status(200).json({ success: true, message: 'Payment verified.', order });
});

// ── POST /api/payment/webhook ─────────────────────────────────────────────────
// NOTE: body-parser must be set to raw/Buffer for this route (see server.js)
const webhook = asyncCatch(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) throw new AppError('Webhook signature missing.', 400);

    const result = await paymentService.handleWebhook(req.body, signature);
    res.status(200).json(result);
});

// ── POST /api/payment/refund ──────────────────────────────────────────────────
const refund = asyncCatch(async (req, res) => {
    const { orderId, amount } = req.body;
    if (!orderId) throw new AppError('orderId is required.', 400);

    const refundData = await paymentService.initiateRefund({
        orderId,
        amount,
        userId:  req.user._id,
        isAdmin: req.user.role === 'admin' || req.user.role === 'superadmin',
    });

    res.status(200).json({ success: true, message: 'Refund initiated.', refund: refundData });
});

module.exports = { initiatePayment, verifyPayment, webhook, refund };
