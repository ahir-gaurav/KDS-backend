// backend/controllers/couponController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const supabase   = require('../config/supabase');

// POST /api/coupons/validate
const validateCoupon = asyncCatch(async (req, res) => {
    const { code, subtotal } = req.body;
    if (!code) throw new AppError('Coupon code is required.', 400);

    const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

    if (error || !coupon) throw new AppError('Invalid coupon code.', 404);
    if (new Date(coupon.expiry_date) < new Date()) throw new AppError('Coupon expired.', 400);
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        throw new AppError('Coupon usage limit reached.', 400);
    }
    if (subtotal < Number(coupon.min_purchase)) {
        throw new AppError(`Minimum order value ₹${coupon.min_purchase} required.`, 400);
    }

    // Check if user already used this coupon
    const { data: usage } = await supabase
        .from('coupon_usage')
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('user_id', req.user.id)
        .limit(1);

    if (usage && usage.length > 0) {
        throw new AppError('You have already used this coupon.', 400);
    }

    if (coupon.discount_type === 'firstOrder') {
        const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', req.user.id);
        
        if (count > 0) {
            throw new AppError('This coupon is only valid on your first order.', 400);
        }
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
        discountAmount = Math.round((subtotal * Number(coupon.discount_amount)) / 100);
        if (coupon.max_discount && discountAmount > Number(coupon.max_discount)) {
            discountAmount = Number(coupon.max_discount);
        }
    } else {
        discountAmount = Number(coupon.discount_amount);
    }

    res.json({ valid: true, discount: coupon.discount_amount, discountAmount, coupon });
});

// Admin CRUD
const getAllCoupons = asyncCatch(async (req, res) => {
    const { data: coupons, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new AppError('Error fetching coupons.', 500);
    res.json({ coupons });
});

const createCoupon = asyncCatch(async (req, res) => {
    const { data: coupon, error } = await supabase
        .from('coupons')
        .insert({ ...req.body, code: req.body.code.toUpperCase() })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') throw new AppError('Coupon code already exists.', 400);
        throw new AppError(error.message, 500);
    }
    res.status(201).json({ coupon });
});

const updateCoupon = asyncCatch(async (req, res) => {
    const { data: coupon, error } = await supabase
        .from('coupons')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();

    if (error || !coupon) throw new AppError('Coupon not found.', 404);
    res.json({ coupon });
});

const deleteCoupon = asyncCatch(async (req, res) => {
    const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', req.params.id);

    if (error) throw new AppError('Error deleting coupon.', 500);
    res.json({ message: 'Coupon deleted.' });
});

module.exports = { validateCoupon, getAllCoupons, createCoupon, updateCoupon, deleteCoupon };
