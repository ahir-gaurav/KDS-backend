// backend/controllers/reviewController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const Review     = require('../models/Review');
const Order      = require('../models/Order');
const { ORDER_STATUS } = require('../config/constants');

// ── POST /api/reviews ─────────────────────────────────────────────────────────
const createReview = asyncCatch(async (req, res) => {
    const { productId, rating, comment, images } = req.body;
    if (!productId || !rating) throw new AppError('Product ID and rating are required.', 400);

    // Check verified purchase
    const verifiedOrder = await Order.findOne({
        user:            req.user._id,
        'items.product': productId,
        status:          ORDER_STATUS.DELIVERED,
    });

    const existing = await Review.findOne({ user: req.user._id, product: productId });
    if (existing) throw new AppError('You have already reviewed this product.', 409);

    const review = await Review.create({
        user:     req.user._id,
        product:  productId,
        rating,
        comment,
        images,
        verified: !!verifiedOrder,
    });

    res.status(201).json({ success: true, message: 'Review submitted.', review });
});

// ── GET /api/reviews/product/:productId ───────────────────────────────────────
const getProductReviews = asyncCatch(async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip  = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
        Review.find({ product: req.params.productId, isActive: true })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name avatar'),
        Review.countDocuments({ product: req.params.productId, isActive: true }),
    ]);

    res.status(200).json({ success: true, reviews, total, page, pages: Math.ceil(total / limit) });
});

// ── PUT /api/reviews/:id ──────────────────────────────────────────────────────
const updateReview = asyncCatch(async (req, res) => {
    const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
    if (!review) throw new AppError('Review not found.', 404);

    const { rating, comment, images } = req.body;
    if (rating)  review.rating  = rating;
    if (comment) review.comment = comment;
    if (images)  review.images  = images;
    await review.save();

    res.status(200).json({ success: true, message: 'Review updated.', review });
});

// ── DELETE /api/reviews/:id ───────────────────────────────────────────────────
const deleteReview = asyncCatch(async (req, res) => {
    const filter = req.user.role === 'admin'
        ? { _id: req.params.id }
        : { _id: req.params.id, user: req.user._id };

    const review = await Review.findOneAndDelete(filter);
    if (!review) throw new AppError('Review not found.', 404);

    res.status(200).json({ success: true, message: 'Review deleted.' });
});

module.exports = { createReview, getProductReviews, updateReview, deleteReview };
