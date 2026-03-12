const Hero = require('../models/Hero');
const Ticker = require('../models/Ticker');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');

// Admin Auth
const adminSignup = async (req, res) => {
    try {
        const { name, email, password, adminCode } = req.body;
        if (adminCode !== process.env.ADMIN_SECRET_CODE) {
            return res.status(403).json({ message: 'Invalid admin secret code' });
        }
        const existing = await Admin.findOne({ email });
        if (existing) return res.status(400).json({ message: 'Admin email already registered' });
        const admin = await Admin.create({ name, email, password });
        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('adminToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(201).json({ admin: { id: admin._id, name: admin.name, email: admin.email }, token });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isMatch = await admin.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('adminToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ admin: { id: admin._id, name: admin.name, email: admin.email }, token });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const adminLogout = (req, res) => {
    res.clearCookie('adminToken', { httpOnly: true, sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
    res.json({ message: 'Admin logged out' });
};

const getAdminMe = (req, res) => res.json({ admin: req.admin });

const updateAdminProfile = async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword } = req.body;
        const admin = await Admin.findById(req.admin._id);
        if (name) admin.name = name;
        if (email) admin.email = email;
        if (currentPassword && newPassword) {
            const isMatch = await admin.comparePassword(currentPassword);
            if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
            admin.password = newPassword;
        }
        await admin.save();
        res.json({ admin: { id: admin._id, name: admin.name, email: admin.email } });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Dashboard Stats
const getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [totalUsers, totalProducts, todayOrders, monthOrders, allOrders, totalRevenue, lowStock] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Order.countDocuments({ createdAt: { $gte: startOfToday } }),
            Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Order.countDocuments(),
            Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalPrice' } } }]),
            Product.find({ stock: { $lt: (await Settings.findOne())?.lowStockThreshold || 5 }, isActive: true }).select('name stock').limit(10),
        ]);

        const fastSelling = await Product.find({ isActive: true }).sort({ soldCount: -1 }).limit(5).select('name soldCount images');
        const slowSelling = await Product.find({ isActive: true }).sort({ soldCount: 1 }).limit(5).select('name soldCount images');

        // Last 30 days orders chart
        const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const ordersChart = await Order.aggregate([
            { $match: { createdAt: { $gte: last30 } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$totalPrice' } } },
            { $sort: { _id: 1 } },
        ]);

        // Revenue by month (last 6 months)
        const revenueChart = await Order.aggregate([
            { $match: { paymentStatus: 'paid', createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$totalPrice' } } },
            { $sort: { _id: 1 } },
        ]);

        // Category sales
        const categorySales = await Order.aggregate([
            { $unwind: '$products' },
            { $lookup: { from: 'products', localField: 'products.product', foreignField: '_id', as: 'prod' } },
            { $unwind: '$prod' },
            { $group: { _id: '$prod.category', totalSold: { $sum: '$products.quantity' }, revenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } } } },
        ]);

        res.json({
            totalUsers,
            totalProducts,
            todayOrders,
            monthOrders,
            allOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            lowStock,
            fastSelling,
            slowSelling,
            ordersChart,
            revenueChart,
            categorySales,
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Hero CRUD
const getHero = async (req, res) => {
    try {
        const slides = await Hero.find({ isActive: true }).sort({ displayOrder: 1 });
        res.json({ slides });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
const getAllHero = async (req, res) => {
    try {
        const slides = await Hero.find().sort({ displayOrder: 1 });
        res.json({ slides });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
const createHero = async (req, res) => {
    try {
        const { title, subtitle, buttonText, buttonLink, displayOrder } = req.body;
        const image = req.file ? req.file.path : req.body.image;
        if (!image) return res.status(400).json({ message: 'Image is required' });
        const slide = await Hero.create({ title, subtitle, image, buttonText, buttonLink, displayOrder: displayOrder || 0 });
        res.status(201).json({ slide });
    } catch (error) { res.status(500).json({ message: 'Server error', error: error.message }); }
};
const updateHero = async (req, res) => {
    try {
        const { title, subtitle, buttonText, buttonLink, displayOrder, isActive } = req.body;
        const slide = await Hero.findById(req.params.id);
        if (!slide) return res.status(404).json({ message: 'Slide not found' });
        if (title) slide.title = title;
        if (subtitle !== undefined) slide.subtitle = subtitle;
        if (req.file) slide.image = req.file.path;
        if (buttonText) slide.buttonText = buttonText;
        if (buttonLink) slide.buttonLink = buttonLink;
        if (displayOrder !== undefined) slide.displayOrder = displayOrder;
        if (isActive !== undefined) slide.isActive = isActive === 'true' || isActive === true;
        await slide.save();
        res.json({ slide });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
const deleteHero = async (req, res) => {
    try {
        await Hero.findByIdAndDelete(req.params.id);
        res.json({ message: 'Slide deleted' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

// Ticker CRUD
const getTicker = async (req, res) => {
    try {
        const messages = await Ticker.find({ isActive: true }).sort({ displayOrder: 1 });
        res.json({ messages });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
const getAllTicker = async (req, res) => {
    try {
        const messages = await Ticker.find().sort({ displayOrder: 1 });
        res.json({ messages });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
const createTicker = async (req, res) => {
    try {
        const message = await Ticker.create(req.body);
        res.status(201).json({ message });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
const updateTicker = async (req, res) => {
    try {
        const message = await Ticker.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!message) return res.status(404).json({ message: 'Ticker not found' });
        res.json({ message });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
const deleteTicker = async (req, res) => {
    try {
        await Ticker.findByIdAndDelete(req.params.id);
        res.json({ message: 'Ticker deleted' });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

// Settings
const getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});
        res.json({ settings });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
const updateSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();
        Object.assign(settings, req.body);
        await settings.save();
        res.json({ settings });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

// User management (admin)
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

module.exports = {
    adminSignup, adminLogin, adminLogout, getAdminMe, updateAdminProfile,
    getDashboardStats,
    getHero, getAllHero, createHero, updateHero, deleteHero,
    getTicker, getAllTicker, createTicker, updateTicker, deleteTicker,
    getSettings, updateSettings,
    getAllUsers,
};
