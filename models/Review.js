// backend/models/Review.js
'use strict';

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
    {
        user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
        product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        rating:    { type: Number, required: true, min: 1, max: 5 },
        comment:   { type: String, trim: true, maxlength: 1000 },
        verified:  { type: Boolean, default: false },  // true if user bought the product
        images:    [{ type: String }],                 // optional review photos
        likes:     { type: Number, default: 0, min: 0 },
        isActive:  { type: Boolean, default: true },
    },
    { timestamps: true }
);

// ── One review per user per product ──────────────────────────────────────────
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });

// ── After save/remove: update product's average rating ───────────────────────
const updateProductRating = async (productId) => {
    const Product = mongoose.model('Product');
    const stats = await mongoose.model('Review').aggregate([
        { $match: { product: productId, isActive: true } },
        { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            'ratings.average': +stats[0].avg.toFixed(1),
            'ratings.count':   stats[0].count,
        });
    } else {
        await Product.findByIdAndUpdate(productId, {
            'ratings.average': 0,
            'ratings.count':   0,
        });
    }
};

reviewSchema.post('save', function () { updateProductRating(this.product); });
reviewSchema.post('remove', function () { updateProductRating(this.product); });
reviewSchema.post('findOneAndDelete', function (doc) {
    if (doc) updateProductRating(doc.product);
});

module.exports = mongoose.model('Review', reviewSchema);
