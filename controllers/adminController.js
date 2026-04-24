// backend/controllers/adminController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const supabase   = require('../config/supabase');

// ── Dashboard Stats (Admin Only) ─────────────────────────────────────────────
const getDashboardStats = asyncCatch(async (req, res) => {
    const [
        { count: totalOrders },
        { count: totalUsers },
        { count: totalProducts },
        { data: revenueData }
    ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('orders').select('total_amount').eq('payment_status', 'paid')
    ]);

    const totalRevenue = revenueData?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

    res.status(200).json({
        success: true,
        stats: {
            totalOrders: totalOrders || 0,
            totalUsers: totalUsers || 0,
            totalProducts: totalProducts || 0,
            totalRevenue
        }
    });
});

// ── CMS: Hero Section ────────────────────────────────────────────────────────
const getHero = asyncCatch(async (req, res) => {
    const { data: hero } = await supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    res.status(200).json({ success: true, hero });
});

const updateHero = asyncCatch(async (req, res) => {
    // Upsert logic: if there is an existing hero, update it, else insert.
    // Simplified: update the latest or insert new.
    const { data: existing } = await supabase.from('hero_slides').select('id').limit(1).single();

    let result;
    if (existing) {
        result = await supabase.from('hero_slides').update(req.body).eq('id', existing.id).select().single();
    } else {
        result = await supabase.from('hero_slides').insert(req.body).select().single();
    }

    if (result.error) throw new AppError('Error updating hero.', 500);

    res.status(200).json({ success: true, message: 'Hero updated.', hero: result.data });
});

// ── CMS: Ticker ──────────────────────────────────────────────────────────────
const getTicker = asyncCatch(async (req, res) => {
    const { data: ticker } = await supabase
        .from('tickers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    res.status(200).json({ success: true, ticker });
});

const updateTicker = asyncCatch(async (req, res) => {
    const { data: existing } = await supabase.from('tickers').select('id').limit(1).single();

    let result;
    if (existing) {
        result = await supabase.from('tickers').update(req.body).eq('id', existing.id).select().single();
    } else {
        result = await supabase.from('tickers').insert(req.body).select().single();
    }

    if (result.error) throw new AppError('Error updating ticker.', 500);

    res.status(200).json({ success: true, message: 'Ticker updated.', ticker: result.data });
});

// ── CMS: Settings ────────────────────────────────────────────────────────────
const getSettings = asyncCatch(async (req, res) => {
    const { data: settings } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .single();

    res.status(200).json({ success: true, settings });
});

const updateSettings = asyncCatch(async (req, res) => {
    const { data: existing } = await supabase.from('site_settings').select('id').limit(1).single();

    let result;
    if (existing) {
        result = await supabase.from('site_settings').update(req.body).eq('id', existing.id).select().single();
    } else {
        result = await supabase.from('site_settings').insert(req.body).select().single();
    }

    if (result.error) throw new AppError('Error updating settings.', 500);

    res.status(200).json({ success: true, message: 'Settings updated.', settings: result.data });
});

module.exports = { 
    getDashboardStats, 
    getHero, updateHero, 
    getTicker, updateTicker, 
    getSettings, updateSettings 
};
