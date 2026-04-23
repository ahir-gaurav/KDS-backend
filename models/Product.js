// backend/models/Product.js
'use strict';

const mongoose = require('mongoose');
const slugify  = require('../utils/slugify');
const { PRODUCT_TAGS } = require('../config/constants');

// ── Sub-schemas ───────────────────────────────────────────────────────────────
const variantSchema = new mongoose.Schema(
    {
        size:  { type: String, required: true, trim: true },
        stock: { type: Number, required: true, default: 0, min: 0 },
        sku:   { type: String, trim: true },
    },
    { _id: true }
);

const ratingsSchema = new mongoose.Schema(
    {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count:   { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const productSchema = new mongoose.Schema(
    {
        title:       { type: String, required: true, trim: true },
        slug:        { type: String, unique: true, lowercase: true },
        description: { type: String, required: true },
        price:       { type: Number, required: true, min: 0 },    // base / MRP
        discount:    { type: Number, default: 0, min: 0, max: 90 }, // %
        salePrice:   { type: Number },                             // computed or manual
        images:      [{ type: String }],                           // Cloudinary URLs
        category:    { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
        brand:       { type: String, trim: true },
        stock:       { type: Number, default: 0, min: 0 },       // flat stock fallback
        variants:    [variantSchema],                              // size-level stock
        ratings:     ratingsSchema,
        reviews:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],

        soldCount:   { type: Number, default: 0, min: 0 },
        tags:        [{ type: String, enum: PRODUCT_TAGS }],

        isActive:    { type: Boolean, default: true },
        isFeatured:  { type: Boolean, default: false },

        // Offer fields
        isOfferActive: { type: Boolean, default: false },
        offerLabel:    { type: String, trim: true },
    },
    { timestamps: true }
);

// ── Auto-generate slug ────────────────────────────────────────────────────────
productSchema.pre('save', function (next) {
    if (this.isModified('title')) this.slug = slugify(this.title);
    next();
});

// ── Virtual: effective selling price ─────────────────────────────────────────
productSchema.virtual('effectivePrice').get(function () {
    if (this.salePrice) return this.salePrice;
    return +(this.price * (1 - this.discount / 100)).toFixed(2);
});

// ── Indexes ───────────────────────────────────────────────────────────────────
productSchema.index({ title: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ price: 1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isFeatured: 1, isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
