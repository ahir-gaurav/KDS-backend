// backend/models/Order.js
'use strict';

const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, REFUND_STATUS } = require('../config/constants');

// ── Sub-schemas ───────────────────────────────────────────────────────────────
const orderItemSchema = new mongoose.Schema(
    {
        product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name:     { type: String, required: true },
        image:    { type: String },
        size:     { type: String },
        quantity: { type: Number, required: true, min: 1 },
        price:    { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const addressSnapshotSchema = new mongoose.Schema(
    {
        fullName:     String,
        phone:        String,
        addressLine1: String,
        addressLine2: String,
        city:         String,
        state:        String,
        pincode:      String,
    },
    { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
    {
        status:    { type: String },
        timestamp: { type: Date, default: Date.now },
        note:      { type: String },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
    {
        user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        orderNumber: { type: String, unique: true },
        items:       [orderItemSchema],   // renamed from "products" for clarity

        subtotal:        { type: Number, required: true, min: 0 },
        gst:             { type: Number, default: 0 },         // %
        gstAmount:       { type: Number, default: 0, min: 0 },
        deliveryCharge:  { type: Number, default: 0, min: 0 },
        couponCode:      { type: String },
        couponDiscount:  { type: Number, default: 0, min: 0 },
        totalAmount:     { type: Number, required: true, min: 0 }, // renamed from totalPrice

        shippingAddress: addressSnapshotSchema,

        paymentMethod: {
            type:     String,
            enum:     Object.values(PAYMENT_METHOD),
            required: true,
        },
        paymentStatus: {
            type:    String,
            enum:    Object.values(PAYMENT_STATUS),
            default: PAYMENT_STATUS.PENDING,
        },

        // Razorpay fields
        razorpayOrderId:   { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },

        status: {
            type:    String,
            enum:    Object.values(ORDER_STATUS),
            default: ORDER_STATUS.PROCESSING,
        },
        statusHistory: [statusHistorySchema],

        trackingId:   { type: String },
        cancelReason: { type: String },
        refundStatus: {
            type:    String,
            enum:    Object.values(REFUND_STATUS),
            default: REFUND_STATUS.NONE,
        },
    },
    { timestamps: true }
);

// ── Auto-generate KDS order number ────────────────────────────────────────────
orderSchema.pre('save', async function (next) {
    if (!this.isNew || this.orderNumber) return next();
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `KDS${String(count + 1).padStart(6, '0')}`;
    next();
});

// ── Indexes ───────────────────────────────────────────────────────────────────
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', orderSchema);
