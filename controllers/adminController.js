// backend/controllers/adminController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const User       = require('../models/User');
const Order      = require('../models/Order');
const Product    = require('../models/Product');
const Hero       = require('../models/Hero');
const Ticker     = require('../models/Ticker');
const Settings   = require('../models/Settings');

// ── Dashboard Stats (Admin Only) ─────────────────────────────────────────────
const getDashboardStats = asyncCatch(async (req, res) => {
    const [totalOrders, totalUsers, totalProducts, revenueData] = await Promise.all([
        Order.countDocuments(),
        User.countDocuments({ role: 'user' }),
        Product.countDocuments({ isActive: true }),
        Order.aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ])
    ]);

    res.status(200).json({
        success: true,
        stats: {
            totalOrders,
            totalUsers,
            totalProducts,
            totalRevenue: revenueData[0]?.total || 0
        }
    });
});

// ── CMS: Hero Section ────────────────────────────────────────────────────────
const getHero = asyncCatch(async (req, res) => {
    const hero = await Hero.findOne().sort({ createdAt: -1 });
    res.status(200).json({ success: true, hero });
});

const updateHero = asyncCatch(async (req, res) => {
    const hero = await Hero.findOneAndUpdate({}, req.body, { upsert: true, new: true });
    res.status(200).json({ success: true, message: 'Hero updated.', hero });
});

// ── CMS: Ticker ──────────────────────────────────────────────────────────────
const getTicker = asyncCatch(async (req, res) => {
    const ticker = await Ticker.findOne().sort({ createdAt: -1 });
    res.status(200).json({ success: true, ticker });
});

const updateTicker = asyncCatch(async (req, res) => {
    const ticker = await Ticker.findOneAndUpdate({}, req.body, { upsert: true, new: true });
    res.status(200).json({ success: true, message: 'Ticker updated.', ticker });
});

// ── CMS: Settings ────────────────────────────────────────────────────────────
const getSettings = asyncCatch(async (req, res) => {
    const settings = await Settings.findOne();
    res.status(200).json({ success: true, settings });
});

const updateSettings = asyncCatch(async (req, res) => {
    const settings = await Settings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
    res.status(200).json({ success: true, message: 'Settings updated.', settings });
});

module.exports = { 
    getDashboardStats, 
    getHero, updateHero, 
    getTicker, updateTicker, 
    getSettings, updateSettings 
};
