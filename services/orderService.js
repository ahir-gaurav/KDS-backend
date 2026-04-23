// backend/services/orderService.js
'use strict';

const mongoose  = require('mongoose');
const Order     = require('../models/Order');
const Product   = require('../models/Product');
const Cart      = require('../models/Cart');
const AppError  = require('../utils/AppError');
const { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } = require('../config/constants');

/**
 * Validate stock availability for a list of items.
 * Throws AppError if any item is out of stock.
 * @param {Array} items - [{ product: ObjectId, qty, size }]
 * @returns {Array} enriched items with name, image, price
 */
const validateAndEnrichItems = async (items) => {
    const enriched = [];

    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product || !product.isActive) {
            throw new AppError(`Product "${item.product}" is not available.`, 400);
        }

        // Check variant-level stock if size provided, else flat stock
        if (item.size) {
            const variant = product.variants.find((v) => v.size === item.size);
            if (!variant) throw new AppError(`Size "${item.size}" not available for "${product.title}".`, 400);
            if (variant.stock < item.qty)
                throw new AppError(`Only ${variant.stock} units of "${product.title}" (${item.size}) in stock.`, 400);
        } else {
            if (product.stock < item.qty)
                throw new AppError(`Only ${product.stock} units of "${product.title}" in stock.`, 400);
        }

        enriched.push({
            product:  product._id,
            name:     product.title,
            image:    product.images?.[0] || '',
            size:     item.size,
            quantity: item.qty,
            price:    product.salePrice || product.price,
        });
    }

    return enriched;
};

/**
 * Deduct stock after a confirmed order.
 */
const deductStock = async (items) => {
    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) continue;

        if (item.size) {
            const variant = product.variants.find((v) => v.size === item.size);
            if (variant) variant.stock -= item.quantity;
        } else {
            product.stock = Math.max(0, product.stock - item.quantity);
        }

        product.soldCount = (product.soldCount || 0) + item.quantity;
        await product.save();
    }
};

/**
 * Restore stock on order cancellation.
 */
const restoreStock = async (items) => {
    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) continue;

        if (item.size) {
            const variant = product.variants.find((v) => v.size === item.size);
            if (variant) variant.stock += item.quantity;
        } else {
            product.stock += item.quantity;
        }

        product.soldCount = Math.max(0, (product.soldCount || 0) - item.quantity);
        await product.save();
    }
};

/**
 * Calculate order totals.
 */
const calcTotals = ({ items, deliveryCharge = 0, couponDiscount = 0, gstPercent = 18 }) => {
    const subtotal   = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const afterCoupon = subtotal - couponDiscount;
    const gstAmount  = +(afterCoupon * (gstPercent / 100)).toFixed(2);
    const totalAmount = +(afterCoupon + gstAmount + deliveryCharge).toFixed(2);

    return { subtotal, gstAmount, gst: gstPercent, deliveryCharge, couponDiscount, totalAmount };
};

/**
 * Create an order.
 * For Razorpay, the Razorpay order is created separately in paymentService.
 */
const createOrder = async ({ user, items, shippingAddress, paymentMethod, couponCode, deliveryCharge = 0, couponDiscount = 0 }) => {
    const enrichedItems = await validateAndEnrichItems(items);
    const totals = calcTotals({ items: enrichedItems, deliveryCharge, couponDiscount });

    const order = await Order.create({
        user:            user._id,
        items:           enrichedItems,
        shippingAddress,
        paymentMethod,
        couponCode,
        ...totals,
        statusHistory: [{ status: ORDER_STATUS.PROCESSING, note: 'Order placed' }],
    });

    // Deduct stock immediately for COD
    if (paymentMethod === PAYMENT_METHOD.COD) {
        await deductStock(enrichedItems);
        // Clear user's cart
        await Cart.findOneAndUpdate({ user: user._id }, { items: [] });
    }

    return order;
};

/**
 * Get paginated orders for a specific user.
 */
const getUserOrders = async (userId, { page = 1, limit = 10 } = {}) => {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
        Order.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('items.product', 'title images'),
        Order.countDocuments({ user: userId }),
    ]);
    return { orders, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Get paginated orders for admin (all users).
 */
const getAllOrders = async ({ page = 1, limit = 20, status, paymentStatus } = {}) => {
    const filter = {};
    if (status)        filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
        Order.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name email'),
        Order.countDocuments(filter),
    ]);
    return { orders, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Update order status (admin action).
 */
const updateOrderStatus = async (orderId, { status, note, updatedBy }) => {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found.', 404);

    order.status = status;
    order.statusHistory.push({ status, note, updatedBy });
    await order.save();

    return order;
};

/**
 * Cancel an order.
 */
const cancelOrder = async (orderId, { userId, cancelReason, isAdmin = false }) => {
    const filter = isAdmin ? { _id: orderId } : { _id: orderId, user: userId };
    const order  = await Order.findOne(filter);

    if (!order) throw new AppError('Order not found.', 404);

    const cancellableStatuses = [ORDER_STATUS.PROCESSING, ORDER_STATUS.CONFIRMED];
    if (!cancellableStatuses.includes(order.status)) {
        throw new AppError(`Cannot cancel an order that is already "${order.status}".`, 400);
    }

    order.status       = ORDER_STATUS.CANCELLED;
    order.cancelReason = cancelReason || 'Cancelled by user';
    order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, note: cancelReason });

    await order.save();
    await restoreStock(order.items);

    return order;
};

module.exports = {
    createOrder,
    validateAndEnrichItems,
    deductStock,
    restoreStock,
    calcTotals,
    getUserOrders,
    getAllOrders,
    updateOrderStatus,
    cancelOrder,
};
