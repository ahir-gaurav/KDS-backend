// backend/services/authService.js
'use strict';

const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const AppError = require('../utils/AppError');
const { TOKEN_TTL } = require('../config/constants');

// ── Token generators ──────────────────────────────────────────────────────────

const generateAccessToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

const generateRefreshToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });

// ── Cookie helpers ────────────────────────────────────────────────────────────

const setAccessCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge:   TOKEN_TTL.ACCESS,
    });
};

const setRefreshCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge:   TOKEN_TTL.REFRESH,
        path:     '/api/auth/refresh-token',   // restrict cookie scope
    });
};

const clearAuthCookies = (res) => {
    const opts = {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    };
    res.clearCookie('token',         opts);
    res.clearCookie('refreshToken',  { ...opts, path: '/api/auth/refresh-token' });
};

// ── Core auth service methods ─────────────────────────────────────────────────

/**
 * Register a new user (without verifying email yet).
 * Returns the created user + OTP for email dispatch.
 */
const registerUser = async ({ name, email, password }) => {
    const existing = await User.findOne({ email });

    if (existing?.isVerified) {
        throw new AppError('An account with this email already exists.', 409);
    }

    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + TOKEN_TTL.OTP);

    if (existing && !existing.isVerified) {
        // Re-use unverified account — update details and resend OTP
        existing.name                  = name;
        existing.password              = password;   // pre-save hook hashes
        existing.verificationOTP       = otp;
        existing.verificationOTPExpiry = expiry;
        await existing.save();
        return { user: existing, otp, isNew: false };
    }

    const user = await User.create({
        name,
        email,
        password,
        verificationOTP:       otp,
        verificationOTPExpiry: expiry,
    });

    return { user, otp, isNew: true };
};

/**
 * Verify the registration OTP and mark the account as verified.
 * Returns the verified user.
 */
const verifyRegistrationOTP = async ({ email, otp }) => {
    const user = await User.findOne({ email })
        .select('+verificationOTP +verificationOTPExpiry');

    if (!user)          throw new AppError('User not found.', 404);
    if (user.isVerified) throw new AppError('Account already verified.', 400);
    if (user.verificationOTP !== otp)
        throw new AppError('Invalid OTP.', 400);
    if (user.verificationOTPExpiry < new Date())
        throw new AppError('OTP has expired. Please request a new one.', 400);

    user.isVerified            = true;
    user.verificationOTP       = undefined;
    user.verificationOTPExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    return user;
};

/**
 * Authenticate user with email + password.
 * Returns the authenticated user.
 */
const loginUser = async ({ email, password }) => {
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
        throw new AppError('Invalid email or password.', 401);
    }
    if (!user.isVerified) {
        throw new AppError('Please verify your email before logging in.', 401);
    }
    if (!user.isActive) {
        throw new AppError('Your account has been deactivated. Contact support.', 403);
    }

    return user;
};

/**
 * Rotate refresh token — verify existing RT, issue new pair.
 */
const refreshTokens = async (refreshToken) => {
    if (!refreshToken) throw new AppError('Refresh token missing.', 401);

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
        throw new AppError('Invalid or expired refresh token.', 401);
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) throw new AppError('User not found or deactivated.', 401);

    return user;
};

/**
 * Initiate forgot-password flow — generates reset OTP.
 */
const forgotPassword = async (email) => {
    const user = await User.findOne({ email }).select('+resetOTP +resetOTPExpiry');
    if (!user) throw new AppError('No account found with this email address.', 404);

    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + TOKEN_TTL.OTP);

    user.resetOTP       = otp;
    user.resetOTPExpiry = expiry;
    await user.save({ validateBeforeSave: false });

    return { user, otp };
};

/**
 * Complete password reset using OTP.
 */
const resetPassword = async ({ email, otp, newPassword }) => {
    const user = await User.findOne({ email }).select('+resetOTP +resetOTPExpiry +password');
    if (!user)                             throw new AppError('User not found.', 404);
    if (user.resetOTP !== otp)             throw new AppError('Invalid OTP.', 400);
    if (user.resetOTPExpiry < new Date())  throw new AppError('OTP expired.', 400);

    user.password       = newPassword;  // pre-save hook hashes it
    user.resetOTP       = undefined;
    user.resetOTPExpiry = undefined;
    await user.save();

    return user;
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    setAccessCookie,
    setRefreshCookie,
    clearAuthCookies,
    registerUser,
    verifyRegistrationOTP,
    loginUser,
    refreshTokens,
    forgotPassword,
    resetPassword,
};
