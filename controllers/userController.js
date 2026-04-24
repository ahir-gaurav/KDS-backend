// backend/controllers/userController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const supabase   = require('../config/supabase');
const { pick }   = require('../utils/helpers');

const sanitizeUser = (user) => {
    const { password, refresh_token, verification_otp, verification_otp_expiry, reset_otp, reset_otp_expiry, ...safe } = user;
    return safe;
};

// ── GET /api/user/profile ─────────────────────────────────────────────────────
const getProfile = asyncCatch(async (req, res) => {
    res.status(200).json({ success: true, user: sanitizeUser(req.user) });
});

// ── PATCH /api/user/profile ──────────────────────────────────────────────────
const updateProfile = asyncCatch(async (req, res) => {
    const updates = pick(req.body, ['name', 'phone', 'avatar']);
    
    const { data: user, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', req.user.id)
        .select()
        .single();

    if (error) throw new AppError('Error updating profile.', 500);

    res.status(200).json({ 
        success: true, 
        message: 'Profile updated successfully.', 
        user: sanitizeUser(user) 
    });
});

// ── POST /api/user/addresses ──────────────────────────────────────────────────
const addAddress = asyncCatch(async (req, res) => {
    const address = req.body;
    let addresses = [...(req.user.addresses || [])];

    if (address.isDefault) {
        addresses.forEach(a => a.isDefault = false);
    }
    
    // Add id to address manually if needed, or let postgres handle if it was a separate table.
    // Since it's JSONB, we'll just push it.
    const newAddress = { ...address, id: crypto.randomUUID() };
    addresses.push(newAddress);

    const { data, error } = await supabase
        .from('users')
        .update({ addresses })
        .eq('id', req.user.id)
        .select()
        .single();

    if (error) throw new AppError('Error adding address.', 500);
    
    res.status(201).json({ 
        success: true, 
        message: 'Address added.', 
        addresses: data.addresses 
    });
});

// ── DELETE /api/user/addresses/:addressId ────────────────────────────────────
const removeAddress = asyncCatch(async (req, res) => {
    const addresses = (req.user.addresses || []).filter(
        a => a.id !== req.params.addressId && a._id !== req.params.addressId
    );

    const { data, error } = await supabase
        .from('users')
        .update({ addresses })
        .eq('id', req.user.id)
        .select()
        .single();

    if (error) throw new AppError('Error removing address.', 500);
    
    res.status(200).json({ 
        success: true, 
        message: 'Address removed.', 
        addresses: data.addresses 
    });
});

module.exports = { getProfile, updateProfile, addAddress, removeAddress };
