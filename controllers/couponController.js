const Coupon = require('../models/Coupon');
const Order = require('../models/Order');

// POST /api/coupons/validate
const validateCoupon = async (req, res) => {
    try {
        const { code, subtotal } = req.body;
        const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

        if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });
        if (coupon.expiryDate < new Date()) return res.status(400).json({ message: 'Coupon expired' });
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ message: 'Coupon usage limit reached' });
        }
        if (subtotal < coupon.minOrderValue) {
            return res.status(400).json({ message: `Minimum order value ₹${coupon.minOrderValue} required` });
        }
        if (coupon.usedBy.includes(req.user._id)) {
            return res.status(400).json({ message: 'You have already used this coupon' });
        }

        if (coupon.type === 'firstOrder') {
            const prevOrders = await Order.countDocuments({ user: req.user._id });
            if (prevOrders > 0) {
                return res.status(400).json({ message: 'This coupon is only valid on your first order' });
            }
        }

        const discountAmount = Math.round((subtotal * coupon.discount) / 100);
        res.json({ valid: true, discount: coupon.discount, discountAmount, coupon });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin CRUD
const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.json({ coupons });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const createCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.create(req.body);
        res.status(201).json({ coupon });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ message: 'Coupon code already exists' });
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const updateCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
        res.json({ coupon });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Coupon deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { validateCoupon, getAllCoupons, createCoupon, updateCoupon, deleteCoupon };
