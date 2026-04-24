// backend/controllers/reviewController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const supabase   = require('../config/supabase');
const reviewService = require('../services/reviewService');
const { ORDER_STATUS } = require('../config/constants');

// ── POST /api/reviews ─────────────────────────────────────────────────────────
const createReview = asyncCatch(async (req, res) => {
    const { productId, rating, comment, images } = req.body;
    if (!productId || !rating) throw new AppError('Product ID and rating are required.', 400);

    // Check verified purchase
    const { data: verifiedOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('status', ORDER_STATUS.DELIVERED)
        .contains('order_items', [{ product_id: productId }]) // This might be tricky with JSONB items
        .limit(1)
        .single();
    
    // Note: Since order_items is a separate table, I should check there.
    const { data: item } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('product_id', productId)
        .eq('order:orders(user_id)', req.user.id) // This join might not work this way in Supabase client
        .limit(1);

    // Better way: join orders and order_items
    const { data: verified } = await supabase
        .from('order_items')
        .select('id, orders!inner(status, user_id)')
        .eq('product_id', productId)
        .eq('orders.user_id', req.user.id)
        .eq('orders.status', ORDER_STATUS.DELIVERED)
        .limit(1);

    const isVerified = verified && verified.length > 0;

    const review = await reviewService.createReview({
        user_id:     req.user.id,
        product_id:  productId,
        rating,
        comment,
        images,
        is_verified_purchase: isVerified,
    });

    res.status(201).json({ success: true, message: 'Review submitted.', review });
});

// ── GET /api/reviews/product/:productId ───────────────────────────────────────
const getProductReviews = asyncCatch(async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const { reviews, total } = await reviewService.getProductReviews(req.params.productId, { page, limit });

    res.status(200).json({ success: true, reviews, total, page, pages: Math.ceil(total / limit) });
});

// ── PUT /api/reviews/:id ──────────────────────────────────────────────────────
const updateReview = asyncCatch(async (req, res) => {
    const { rating, comment, images } = req.body;
    const review = await reviewService.updateReview(req.params.id, req.user.id, { rating, comment, images });

    res.status(200).json({ success: true, message: 'Review updated.', review });
});

// ── DELETE /api/reviews/:id ───────────────────────────────────────────────────
const deleteReview = asyncCatch(async (req, res) => {
    await reviewService.deleteReview(req.params.id, req.user.id, req.user.role === 'admin');
    res.status(200).json({ success: true, message: 'Review deleted.' });
});

module.exports = { createReview, getProductReviews, updateReview, deleteReview };
