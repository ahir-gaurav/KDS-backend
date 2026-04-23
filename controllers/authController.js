// backend/controllers/authController.js
'use strict';

const { createPublicKey } = require('crypto');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const asyncCatch  = require('../utils/asyncCatch');
const AppError    = require('../utils/AppError');
const authService = require('../services/authService');
const emailService = require('../services/emailService');

// ── Clerk JWKS helpers (kept for Clerk social login compatibility) ─────────────
const jwksCache = {};
const fetchClerkJWKS = async (issuer) => {
    const cached = jwksCache[issuer];
    if (cached && Date.now() - cached.time < 3600000) return cached.keys;
    const res = await fetch(`${issuer}/.well-known/jwks.json`);
    if (!res.ok) throw new Error('Failed to fetch Clerk JWKS');
    const { keys } = await res.json();
    jwksCache[issuer] = { keys, time: Date.now() };
    return keys;
};
const verifyClerkToken = async (token) => {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded?.payload?.iss) throw new Error('Invalid Clerk token');
    const { iss } = decoded.payload;
    if (!iss.includes('clerk')) throw new Error('Not a Clerk token');
    const keys = await fetchClerkJWKS(iss);
    const matchingKey = keys.find((k) => k.kid === decoded.header.kid);
    if (!matchingKey) throw new Error('Clerk signing key not found');
    const publicKey = createPublicKey({ key: matchingKey, format: 'jwk' });
    return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
const register = asyncCatch(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
        throw new AppError('Name, email and password are required.', 400);

    const { user, otp, isNew } = await authService.registerUser({ name, email, password });
    await emailService.sendWelcomeOTP(user, otp);

    res.status(isNew ? 201 : 200).json({
        success: true,
        message: isNew ? 'Account created. Check your email for the OTP.' : 'OTP resent to email.',
        email,
    });
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
const verifyOTP = asyncCatch(async (req, res) => {
    const { email, otp } = req.body;
    const user = await authService.verifyRegistrationOTP({ email, otp });

    const accessToken  = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    authService.setAccessCookie(res, accessToken);
    authService.setRefreshCookie(res, refreshToken);

    res.status(200).json({
        success: true,
        message: 'Email verified successfully.',
        token:   accessToken,
        user:    user.toSafeObject(),
    });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = asyncCatch(async (req, res) => {
    const { email, password } = req.body;
    const user = await authService.loginUser({ email, password });

    const accessToken  = authService.generateAccessToken(user._id);
    const refreshToken = authService.generateRefreshToken(user._id);

    authService.setAccessCookie(res, accessToken);
    authService.setRefreshCookie(res, refreshToken);

    res.status(200).json({
        success: true,
        message: 'Login successful.',
        token:   accessToken,
        user:    user.toSafeObject(),
    });
});

// ── POST /api/auth/refresh-token ──────────────────────────────────────────────
const refreshToken = asyncCatch(async (req, res) => {
    const token = req.cookies?.refreshToken;
    const user  = await authService.refreshTokens(token);

    const newAccess  = authService.generateAccessToken(user._id);
    const newRefresh = authService.generateRefreshToken(user._id);

    authService.setAccessCookie(res, newAccess);
    authService.setRefreshCookie(res, newRefresh);

    res.status(200).json({ success: true, token: newAccess });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = asyncCatch(async (req, res) => {
    res.status(200).json({ success: true, user: req.user.toSafeObject() });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
const logout = asyncCatch(async (req, res) => {
    authService.clearAuthCookies(res);
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
const forgotPassword = asyncCatch(async (req, res) => {
    const { email } = req.body;
    const { user, otp } = await authService.forgotPassword(email);
    await emailService.sendPasswordResetOTP(user, otp);
    res.status(200).json({ success: true, message: 'Password reset OTP sent to email.' });
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
const resetPassword = asyncCatch(async (req, res) => {
    const { email, otp, newPassword } = req.body;
    await authService.resetPassword({ email, otp, newPassword });
    res.status(200).json({ success: true, message: 'Password reset successful. Please log in.' });
});

// ── POST /api/auth/clerk-sync ─────────────────────────────────────────────────
const clerkSync = asyncCatch(async (req, res) => {
    const { clerkToken, email, name } = req.body;
    if (!clerkToken || !email) throw new AppError('clerkToken and email are required.', 400);

    await verifyClerkToken(clerkToken);

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        user = await User.create({
            name:       name || email.split('@')[0],
            email:      email.toLowerCase(),
            password:   jwt.sign({ email }, process.env.JWT_SECRET),
            isVerified: true,
        });
    } else if (!user.isVerified) {
        user.isVerified = true;
        await user.save();
    }

    const accessToken = authService.generateAccessToken(user._id);
    authService.setAccessCookie(res, accessToken);

    res.status(200).json({
        success: true,
        message: 'Synced with Clerk.',
        token:   accessToken,
        user:    user.toSafeObject(),
    });
});

module.exports = { register, verifyOTP, login, refreshToken, getMe, logout, forgotPassword, resetPassword, clerkSync };
