// backend/services/paymentService.js
'use strict';

const Razorpay  = require('razorpay');
const crypto    = require('crypto');
const Order     = require('../models/Order');
const Payment   = require('../models/Payment');
const Cart      = require('../models/Cart');
const AppError  = require('../utils/AppError');
const { deductStock } = require('./orderService');
const { PAYMENT_STATUS, ORDER_STATUS } = require('../config/constants');
const { toPaise } = require('../utils/helpers');

// ── Razorpay instance (lazy — only initialised when keys are present) ─────────
let razorpayInstance = null;
const getRazorpay = () => {
    if (!razorpayInstance) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new AppError('Razorpay credentials are not configured.', 500);
        }
        razorpayInstance = new Razorpay({
            key_id:     process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayInstance;
};

// ── Initiate Razorpay payment ─────────────────────────────────────────────────
/**
 * Creates a Razorpay order and a pending Payment record.
 * Called after createOrder() for non-COD orders.
 */
const initiatePayment = async ({ orderId, userId }) => {
    const order = await Order.findById(orderId);
    if (!order)              throw new AppError('Order not found.', 404);
    if (order.user.toString() !== userId.toString())
        throw new AppError('Not authorized.', 403);
    if (order.paymentStatus === PAYMENT_STATUS.PAID)
        throw new AppError('Order is already paid.', 400);

    const rz = getRazorpay();
    const amountPaise = toPaise(order.totalAmount);

    const rzOrder = await rz.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  order.orderNumber,
    });

    // Update backend order with gateway order ID
    order.razorpayOrderId = rzOrder.id;
    await order.save();

    // Create Payment record in pending state
    await Payment.create({
        order:          order._id,
        user:           userId,
        method:         'razorpay',
        gatewayOrderId: rzOrder.id,
        status:         PAYMENT_STATUS.PENDING,
        amount:         amountPaise,
        receiptId:      order.orderNumber,
    });

    return {
        key:       process.env.RAZORPAY_KEY_ID,
        amount:    amountPaise,
        currency:  'INR',
        orderId:   rzOrder.id,
        orderNumber: order.orderNumber,
    };
};

// ── Verify payment signature ──────────────────────────────────────────────────
/**
 * Verifies the HMAC-SHA256 signature Razorpay sends after payment.
 * Marks order as paid and deducts stock.
 */
const verifyPayment = async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature, userId }) => {
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    if (expectedSignature !== razorpaySignature) {
        throw new AppError('Payment verification failed — invalid signature.', 400);
    }

    const order = await Order.findOne({ razorpayOrderId });
    if (!order) throw new AppError('Order not found for this payment.', 404);
    if (order.user.toString() !== userId.toString())
        throw new AppError('Not authorized.', 403);

    // Update order
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.paymentStatus     = PAYMENT_STATUS.PAID;
    order.status            = ORDER_STATUS.CONFIRMED;
    order.statusHistory.push({ status: ORDER_STATUS.CONFIRMED, note: 'Payment verified' });
    await order.save();

    // Update Payment record
    await Payment.findOneAndUpdate(
        { gatewayOrderId: razorpayOrderId },
        {
            transactionId:   razorpayPaymentId,
            signature:       razorpaySignature,
            status:          PAYMENT_STATUS.PAID,
            gatewayResponse: { razorpayOrderId, razorpayPaymentId, razorpaySignature },
        }
    );

    // Deduct stock and clear cart
    await deductStock(order.items);
    await Cart.findOneAndUpdate({ user: userId }, { items: [] });

    return order;
};

// ── Razorpay webhook handler ──────────────────────────────────────────────────
/**
 * Validates webhook signature and handles payment.captured / payment.failed events.
 * The body must be the raw Buffer (not parsed JSON).
 */
const handleWebhook = async (rawBody, signature) => {
    const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

    if (expectedSig !== signature) {
        throw new AppError('Invalid webhook signature.', 400);
    }

    const event = JSON.parse(rawBody.toString());
    const { entity } = event.payload?.payment || {};

    if (!entity) return { received: true };

    const order = await Order.findOne({ razorpayOrderId: entity.order_id });
    if (!order) return { received: true }; // idempotent

    if (event.event === 'payment.captured') {
        if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
            order.paymentStatus     = PAYMENT_STATUS.PAID;
            order.razorpayPaymentId = entity.id;
            order.status            = ORDER_STATUS.CONFIRMED;
            order.statusHistory.push({ status: ORDER_STATUS.CONFIRMED, note: 'Webhook: payment.captured' });
            await order.save();
            await Payment.findOneAndUpdate(
                { gatewayOrderId: entity.order_id },
                { status: PAYMENT_STATUS.PAID, transactionId: entity.id, gatewayResponse: entity }
            );
        }
    }

    if (event.event === 'payment.failed') {
        order.paymentStatus = PAYMENT_STATUS.FAILED;
        order.statusHistory.push({ status: ORDER_STATUS.PROCESSING, note: 'Webhook: payment.failed' });
        await order.save();
        await Payment.findOneAndUpdate(
            { gatewayOrderId: entity.order_id },
            { status: PAYMENT_STATUS.FAILED, gatewayResponse: entity }
        );
    }

    return { received: true };
};

// ── Initiate refund ───────────────────────────────────────────────────────────
const initiateRefund = async ({ orderId, amount, userId, isAdmin = false }) => {
    const filter = isAdmin ? { _id: orderId } : { _id: orderId, user: userId };
    const order  = await Order.findOne(filter);

    if (!order)                                   throw new AppError('Order not found.', 404);
    if (order.paymentStatus !== PAYMENT_STATUS.PAID) throw new AppError('Order has not been paid.', 400);
    if (!order.razorpayPaymentId)                 throw new AppError('No payment ID on file for this order.', 400);

    const rz         = getRazorpay();
    const refundAmt  = toPaise(amount || order.totalAmount);
    const refund     = await rz.payments.refund(order.razorpayPaymentId, { amount: refundAmt });

    order.paymentStatus = PAYMENT_STATUS.REFUNDED;
    order.refundStatus  = 'initiated';
    await order.save();

    await Payment.findOneAndUpdate(
        { order: order._id },
        { refundId: refund.id, refundAmount: refundAmt, refundedAt: new Date() }
    );

    return refund;
};

module.exports = { initiatePayment, verifyPayment, handleWebhook, initiateRefund };
