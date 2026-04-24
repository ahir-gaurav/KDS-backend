// backend/services/reviewService.js
'use strict';

const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');

/**
 * Update product average rating.
 */
const updateProductRating = async (productId) => {
    const { data: reviews, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', productId);

    if (error) return;

    let average = 0;
    let count = reviews.length;

    if (count > 0) {
        average = reviews.reduce((sum, r) => sum + r.rating, 0) / count;
        average = Number(average.toFixed(1));
    }

    await supabase
        .from('products')
        .update({ ratings: { average, count } })
        .eq('id', productId);
};

const createReview = async (data) => {
    const { data: review, error } = await supabase
        .from('reviews')
        .insert(data)
        .select()
        .single();

    if (error) throw new AppError(error.message, 400);

    await updateProductRating(data.product_id);
    return review;
};

const getProductReviews = async (productId, { page = 1, limit = 10 } = {}) => {
    const offset = (page - 1) * limit;

    const { data, count, error } = await supabase
        .from('reviews')
        .select('*, user:users(name, avatar)', { count: 'exact' })
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new AppError('Error fetching reviews.', 500);

    return { reviews: data, total: count };
};

const updateReview = async (id, userId, data) => {
    const { data: updated, error } = await supabase
        .from('reviews')
        .update(data)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

    if (error || !updated) throw new AppError('Review not found or unauthorized.', 404);

    await updateProductRating(updated.product_id);
    return updated;
};

const deleteReview = async (id, userId, isAdmin = false) => {
    let sbQuery = supabase.from('reviews').delete().eq('id', id);
    if (!isAdmin) sbQuery = sbQuery.eq('user_id', userId);

    const { data: deleted, error } = await sbQuery.select().single();

    if (error || !deleted) throw new AppError('Review not found or unauthorized.', 404);

    await updateProductRating(deleted.product_id);
    return deleted;
};

module.exports = {
    createReview,
    getProductReviews,
    updateReview,
    deleteReview,
};
