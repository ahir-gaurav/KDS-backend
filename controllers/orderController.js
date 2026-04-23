// backend/controllers/orderController.js
'use strict';

const asyncCatch   = require('../utils/asyncCatch');
const AppError     = require('../utils/AppError');
const orderService = require('../services/orderService');
const emailService = require('../services/emailService');

// ── POST /api/orders ──────────────────────────────────────────────────────────
const placeOrder = asyncCatch(async (req, res) => {
    const { items, shippingAddress, paymentMethod, couponCode, deliveryCharge, couponDiscount } = req.body;

    if (!items?.length)       throw new AppError('Order must contain at least one item.', 400);
    if (!shippingAddress)     throw new AppError('Shipping address is required.', 400);
    if (!paymentMethod)       throw new AppError('Payment method is required.', 400);

    const order = await orderService.createOrder({
        user:            req.user,
        items,
        shippingAddress,
        paymentMethod,
        couponCode,
        deliveryCharge:  deliveryCharge  || 0,
        couponDiscount:  couponDiscount  || 0,
    });

    // Send confirmation email (non-blocking)
    emailService.sendOrderConfirmation(req.user, order).catch(console.error);

    res.status(201).json({ success: true, message: 'Order placed successfully.', order });
});

// ── GET /api/orders/my ────────────────────────────────────────────────────────
const getMyOrders = asyncCatch(async (req, res) => {
    const result = await orderService.getUserOrders(req.user._id, req.query);
    res.status(200).json({ success: true, ...result });
});

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
const getOrder = asyncCatch(async (req, res) => {
    const { Order } = require('../models/Order');
    const order = await require('../models/Order')
        .findOne({ _id: req.params.id, user: req.user._id })
        .populate('items.product', 'title images');

    if (!order) throw new AppError('Order not found.', 404);
    res.status(200).json({ success: true, order });
});

// ── POST /api/orders/:id/cancel ───────────────────────────────────────────────
const cancelOrder = asyncCatch(async (req, res) => {
    const order = await orderService.cancelOrder(req.params.id, {
        userId:       req.user._id,
        cancelReason: req.body.cancelReason,
    });

    emailService.sendOrderCancelled(req.user, order).catch(console.error);
    res.status(200).json({ success: true, message: 'Order cancelled.', order });
});

// ── GET /api/orders (admin) ───────────────────────────────────────────────────
const getAllOrders = asyncCatch(async (req, res) => {
    const result = await orderService.getAllOrders(req.query);
    res.status(200).json({ success: true, ...result });
});

// ── PUT /api/orders/:id/status (admin) ────────────────────────────────────────
const updateOrderStatus = asyncCatch(async (req, res) => {
    const { status, note } = req.body;
    if (!status) throw new AppError('Status is required.', 400);

    const order = await orderService.updateOrderStatus(req.params.id, {
        status,
        note,
        updatedBy: req.user._id,
    });

    const { ORDER_STATUS } = require('../config/constants');
    const User = require('../models/User');
    const customer = await User.findById(order.user);

    if (customer) {
        if (status === ORDER_STATUS.SHIPPED)   emailService.sendOrderShipped(customer, order).catch(console.error);
        if (status === ORDER_STATUS.DELIVERED) emailService.sendOrderDelivered(customer, order).catch(console.error);
    }

    res.status(200).json({ success: true, message: `Order status updated to "${status}".`, order });
});

// ── DELETE /api/orders/:id (admin) ────────────────────────────────────────────
const adminCancelOrder = asyncCatch(async (req, res) => {
    const order = await orderService.cancelOrder(req.params.id, {
        cancelReason: req.body.cancelReason || 'Cancelled by admin',
        isAdmin:      true,
    });
    res.status(200).json({ success: true, message: 'Order cancelled by admin.', order });
});

module.exports = { placeOrder, getMyOrders, getOrder, cancelOrder, getAllOrders, updateOrderStatus, adminCancelOrder };
