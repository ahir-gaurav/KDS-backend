// backend/models/Payment.js
'use strict';

const mongoose = require('mongoose');
const { PAYMENT_STATUS, PAYMENT_METHOD } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
    {
        order:         { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
        user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true },
        method:        { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
        transactionId: { type: String },              // Razorpay paymentId / Stripe chargeId
        gatewayOrderId:{ type: String },              // Razorpay orderId
        signature:     { type: String },              // Razorpay signature for verification
        status:        { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },
        amount:        { type: Number, required: true, min: 0 },  // in smallest currency unit (paise)
        currency:      { type: String, default: 'INR' },
        receiptId:     { type: String },
        gatewayResponse: { type: mongoose.Schema.Types.Mixed },   // raw gateway payload
        refundId:      { type: String },
        refundAmount:  { type: Number, default: 0 },
        refundedAt:    { type: Date },
    },
    { timestamps: true }
);

paymentSchema.index({ order: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
