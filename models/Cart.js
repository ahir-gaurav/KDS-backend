// backend/models/Cart.js
'use strict';

const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        qty:     { type: Number, required: true, min: 1, default: 1 },
        price:   { type: Number, required: true, min: 0 },  // price at time of add
        size:    { type: String },                           // selected size/variant
    },
    { _id: true }
);

const cartSchema = new mongoose.Schema(
    {
        user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        items:     [cartItemSchema],
        couponCode: { type: String },
        discount:   { type: Number, default: 0, min: 0 },
    },
    { timestamps: true }
);

// ── Virtual: cart total ───────────────────────────────────────────────────────
cartSchema.virtual('total').get(function () {
    const subtotal = this.items.reduce((acc, i) => acc + i.price * i.qty, 0);
    return +(subtotal - this.discount).toFixed(2);
});

cartSchema.index({ user: 1 });

module.exports = mongoose.model('Cart', cartSchema);
