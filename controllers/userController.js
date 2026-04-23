// backend/controllers/userController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const User       = require('../models/User');
const { pick }   = require('../utils/helpers');

// ── GET /api/user/profile ─────────────────────────────────────────────────────
const getProfile = asyncCatch(async (req, res) => {
    // req.user is already attached by protect middleware
    res.status(200).json({ success: true, user: req.user.toSafeObject() });
});

// ── PATCH /api/user/profile ──────────────────────────────────────────────────
const updateProfile = asyncCatch(async (req, res) => {
    const updates = pick(req.body, ['name', 'phone', 'avatar']);
    
    const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({ 
        success: true, 
        message: 'Profile updated successfully.', 
        user: user.toSafeObject() 
    });
});

// ── POST /api/user/addresses ──────────────────────────────────────────────────
const addAddress = asyncCatch(async (req, res) => {
    const address = req.body;
    if (address.isDefault) {
        req.user.addresses.forEach(a => a.isDefault = false);
    }
    
    req.user.addresses.push(address);
    await req.user.save();
    
    res.status(201).json({ 
        success: true, 
        message: 'Address added.', 
        addresses: req.user.addresses 
    });
});

// ── DELETE /api/user/addresses/:addressId ────────────────────────────────────
const removeAddress = asyncCatch(async (req, res) => {
    req.user.addresses = req.user.addresses.filter(
        a => a._id.toString() !== req.params.addressId
    );
    await req.user.save();
    
    res.status(200).json({ 
        success: true, 
        message: 'Address removed.', 
        addresses: req.user.addresses 
    });
});

module.exports = { getProfile, updateProfile, addAddress, removeAddress };
