const crypto = require('crypto');
const Order = require('../models/Order');
const razorpay = require('../config/razorpay');
const { sendOrderConfirmation, sendPaymentFailed } = require('../services/email');
const { verifyRazorpaySignature } = require('../utils/helpers');

// POST /api/payment/verify
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid payment signature' });
        }

        const order = await Order.findById(orderId).populate('user');
        if (!order) return res.status(404).json({ message: 'Order not found' });

        order.paymentStatus = 'paid';
        order.razorpayPaymentId = razorpay_payment_id;
        order.razorpaySignature = razorpay_signature;
        await order.save();

        await sendOrderConfirmation(order.user, order);
        res.json({ message: 'Payment verified', order });
    } catch (error) {
        console.error('Payment verify error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/payment/webhook
const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const body = JSON.stringify(req.body);
        const expectedSig = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(body)
            .digest('hex');

        if (signature !== expectedSig) {
            return res.status(400).json({ message: 'Invalid webhook signature' });
        }

        const event = req.body.event;
        const payment = req.body.payload?.payment?.entity;

        if (event === 'payment.captured') {
            const order = await Order.findOne({ razorpayOrderId: payment.order_id }).populate('user');
            if (order && order.paymentStatus !== 'paid') {
                order.paymentStatus = 'paid';
                order.razorpayPaymentId = payment.id;
                await order.save();
            }
        } else if (event === 'payment.failed') {
            const order = await Order.findOne({ razorpayOrderId: payment.order_id }).populate('user');
            if (order) {
                order.paymentStatus = 'failed';
                await order.save();
                await sendPaymentFailed(order.user, order);
            }
        }

        res.json({ status: 'ok' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/admin/orders/:id/refund
const initiateRefund = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user');
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (!order.razorpayPaymentId) return res.status(400).json({ message: 'No payment to refund' });

        const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
            amount: order.totalPrice * 100,
        });

        order.paymentStatus = 'refunded';
        order.refundStatus = 'initiated';
        await order.save();

        res.json({ message: 'Refund initiated', refund });
    } catch (error) {
        res.status(500).json({ message: 'Refund failed', error: error.message });
    }
};

module.exports = { verifyPayment, handleWebhook, initiateRefund };
