// backend/models/User.js
'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { ROLES } = require('../config/constants');

// ── Sub-schemas ───────────────────────────────────────────────────────────────
const addressSchema = new mongoose.Schema(
    {
        fullName:     { type: String, required: true, trim: true },
        phone:        { type: String, required: true, trim: true },
        addressLine1: { type: String, required: true, trim: true },
        addressLine2: { type: String, trim: true },
        city:         { type: String, required: true, trim: true },
        state:        { type: String, required: true, trim: true },
        pincode:      { type: String, required: true, trim: true },
        isDefault:    { type: Boolean, default: false },
    },
    { _id: true }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
    {
        name:      { type: String, required: true, trim: true },
        email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
        password:  { type: String, required: true, minlength: 6, select: false },
        phone:     { type: String, trim: true },
        role:      { type: String, enum: Object.values(ROLES), default: ROLES.USER },
        avatar:    { type: String },          // Cloudinary URL

        addresses: [addressSchema],

        // Email verification
        isVerified:            { type: Boolean, default: false },
        verificationOTP:       { type: String, select: false },
        verificationOTPExpiry: { type: Date,   select: false },

        // Password reset
        resetOTP:       { type: String, select: false },
        resetOTPExpiry: { type: Date,   select: false },

        // Refresh token (hashed)
        refreshToken: { type: String, select: false },

        // References
        orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],

        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

// ── Pre-save: hash password ───────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// ── Instance methods ──────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
    return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.refreshToken;
    delete obj.verificationOTP;
    delete obj.verificationOTPExpiry;
    delete obj.resetOTP;
    delete obj.resetOTPExpiry;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
