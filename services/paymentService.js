// backend/services/paymentService.js
'use strict';

const Razorpay  = require('razorpay');
const crypto    = require('crypto');
const supabase  = require('../config/supabase');
const AppError  = require('../utils/AppError');
const { deductStock } = require('./orderService');
const { PAYMENT_STATUS, ORDER_STATUS } = require('../config/constants');
const { toPaise } = require('../utils/helpers');

// ── Razorpay instance ─────────────────────────────────────────────────────────
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
const initiatePayment = async ({ orderId, userId }) => {
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error || !order)    throw new AppError('Order not found.', 404);
    if (order.user_id !== userId) throw new AppError('Not authorized.', 403);
    if (order.payment_status === PAYMENT_STATUS.PAID)
        throw new AppError('Order is already paid.', 400);

    const rz = getRazorpay();
    const amountPaise = toPaise(order.total_amount);

    const rzOrder = await rz.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  order.order_number,
    });

    // Update backend order
    await supabase
        .from('orders')
        .update({ razorpay_order_id: rzOrder.id })
        .eq('id', order.id);

    // Create Payment record
    await supabase
        .from('payments')
        .insert({
            order_id:         order.id,
            user_id:          userId,
            method:           'razorpay',
            gateway_order_id: rzOrder.id,
            status:           PAYMENT_STATUS.PENDING,
            amount:           order.total_amount,
            receipt_id:       order.order_number,
        });

    return {
        key:       process.env.RAZORPAY_KEY_ID,
        amount:    amountPaise,
        currency:  'INR',
        orderId:   rzOrder.id,
        orderNumber: order.order_number,
    };
};

// ── Verify payment ────────────────────────────────────────────────────────────
const verifyPayment = async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature, userId }) => {
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

    if (expectedSignature !== razorpaySignature) {
        throw new AppError('Payment verification failed — invalid signature.', 400);
    }

    const { data: order, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('razorpay_order_id', razorpayOrderId)
        .single();

    if (error || !order) throw new AppError('Order not found for this payment.', 404);
    if (order.user_id !== userId) throw new AppError('Not authorized.', 403);

    const newHistory = [...(order.status_history || []), { status: ORDER_STATUS.CONFIRMED, note: 'Payment verified', timestamp: new Date().toISOString() }];

    // Update order
    await supabase
        .from('orders')
        .update({
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature,
            payment_status:     PAYMENT_STATUS.PAID,
            status:            ORDER_STATUS.CONFIRMED,
            status_history:     newHistory
        })
        .eq('id', order.id);

    // Update Payment record
    await supabase
        .from('payments')
        .update({
            transaction_id:   razorpayPaymentId,
            signature:       razorpaySignature,
            status:          PAYMENT_STATUS.PAID,
            gateway_response: { razorpayOrderId, razorpayPaymentId, razorpaySignature },
        })
        .eq('gateway_order_id', razorpayOrderId);

    // Deduct stock and clear cart
    await deductStock(order.order_items);
    await supabase.from('cart_items').delete().eq('user_id', userId);

    return order;
};

// ── Webhook handler ───────────────────────────────────────────────────────────
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

    const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('razorpay_order_id', entity.order_id)
        .single();

    if (!order) return { received: true };

    if (event.event === 'payment.captured') {
        if (order.payment_status !== PAYMENT_STATUS.PAID) {
            const newHistory = [...(order.status_history || []), { status: ORDER_STATUS.CONFIRMED, note: 'Webhook: payment.captured', timestamp: new Date().toISOString() }];
            
            await supabase
                .from('orders')
                .update({
                    payment_status:     PAYMENT_STATUS.PAID,
                    razorpay_payment_id: entity.id,
                    status:            ORDER_STATUS.CONFIRMED,
                    status_history:     newHistory
                })
                .eq('id', order.id);

            await supabase
                .from('payments')
                .update({ status: PAYMENT_STATUS.PAID, transaction_id: entity.id, gateway_response: entity })
                .eq('gateway_order_id', entity.order_id);
        }
    }

    if (event.event === 'payment.failed') {
        const newHistory = [...(order.status_history || []), { status: order.status, note: 'Webhook: payment.failed', timestamp: new Date().toISOString() }];
        
        await supabase
            .from('orders')
            .update({
                payment_status: PAYMENT_STATUS.FAILED,
                status_history: newHistory
            })
            .eq('id', order.id);

        await supabase
            .from('payments')
            .update({ status: PAYMENT_STATUS.FAILED, gateway_response: entity })
            .eq('gateway_order_id', entity.order_id);
    }

    return { received: true };
};

// ── Initiate refund ───────────────────────────────────────────────────────────
const initiateRefund = async ({ orderId, amount, userId, isAdmin = false }) => {
    let sbQuery = supabase.from('orders').select('*').eq('id', orderId);
    if (!isAdmin) sbQuery = sbQuery.eq('user_id', userId);

    const { data: order, error } = await sbQuery.single();

    if (error || !order)                          throw new AppError('Order not found.', 404);
    if (order.payment_status !== PAYMENT_STATUS.PAID) throw new AppError('Order has not been paid.', 400);
    if (!order.razorpay_payment_id)               throw new AppError('No payment ID on file for this order.', 400);

    const rz         = getRazorpay();
    const refundAmt  = toPaise(amount || order.total_amount);
    const refund     = await rz.payments.refund(order.razorpay_payment_id, { amount: refundAmt });

    await supabase
        .from('orders')
        .update({
            payment_status: PAYMENT_STATUS.REFUNDED,
            refund_status:  'initiated'
        })
        .eq('id', order.id);

    await supabase
        .from('payments')
        .update({
            refund_id: refund.id,
            refund_amount: amount || order.total_amount,
            refunded_at: new Date().toISOString()
        })
        .eq('order_id', order.id);

    return refund;
};

module.exports = { initiatePayment, verifyPayment, handleWebhook, initiateRefund };
