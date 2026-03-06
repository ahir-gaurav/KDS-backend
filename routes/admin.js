const express = require('express');
const router = express.Router();
const {
    adminSignup, adminLogin, adminLogout, getAdminMe, updateAdminProfile,
    getDashboardStats,
    getAllHero, createHero, updateHero, deleteHero,
    getAllTicker, createTicker, updateTicker, deleteTicker,
    getSettings, updateSettings,
    getAllUsers,
} = require('../controllers/adminController');
const { getAllOrders, updateOrderStatus } = require('../controllers/orderController');
const { getAllCoupons, createCoupon, updateCoupon, deleteCoupon } = require('../controllers/couponController');
const { createProduct, updateProduct, deleteProduct, addVariant } = require('../controllers/productController');
const { initiateRefund } = require('../controllers/paymentController');
const { adminProtect } = require('../middleware/adminAuth');
const { uploadProduct, uploadHero } = require('../config/cloudinary');

// Auth (public)
router.post('/auth/signup', adminSignup);
router.post('/auth/login', adminLogin);
router.post('/auth/logout', adminLogout);

// All routes below require admin auth
router.use(adminProtect);

router.get('/auth/me', getAdminMe);
router.put('/auth/profile', updateAdminProfile);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Products
router.post('/products', uploadProduct.array('images', 10), createProduct);
router.put('/products/:id', uploadProduct.array('images', 10), updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/variants', addVariant);

// Orders
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/refund', initiateRefund);

// Hero
router.get('/hero', getAllHero);
router.post('/hero', uploadHero.single('image'), createHero);
router.put('/hero/:id', uploadHero.single('image'), updateHero);
router.delete('/hero/:id', deleteHero);

// Ticker
router.get('/ticker', getAllTicker);
router.post('/ticker', createTicker);
router.put('/ticker/:id', updateTicker);
router.delete('/ticker/:id', deleteTicker);

// Coupons
router.get('/coupons', getAllCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Users
router.get('/users', getAllUsers);

module.exports = router;
