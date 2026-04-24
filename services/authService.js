// backend/services/authService.js
'use strict';

const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const supabase = require('../config/supabase');
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
        path:     '/api/auth/refresh-token',
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
 * Register a new user.
 */
const registerUser = async ({ name, email, password }) => {
    const { data: existing, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 is "not found"
        throw new AppError('Error checking existing user.', 500);
    }

    if (existing?.is_verified) {
        throw new AppError('An account with this email already exists.', 409);
    }

    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + TOKEN_TTL.OTP).toISOString();
    const hashedPassword = await bcrypt.hash(password, 12);

    if (existing && !existing.is_verified) {
        // Re-use unverified account
        const { data: updated, error: updateError } = await supabase
            .from('users')
            .update({
                name,
                password: hashedPassword,
                verification_otp: otp,
                verification_otp_expiry: expiry,
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (updateError) throw new AppError('Error updating user.', 500);
        return { user: updated, otp, isNew: false };
    }

    const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            verification_otp: otp,
            verification_otp_expiry: expiry,
        })
        .select()
        .single();

    if (createError) throw new AppError('Error creating user.', 500);

    return { user: newUser, otp, isNew: true };
};

/**
 * Verify OTP.
 */
const verifyRegistrationOTP = async ({ email, otp }) => {
    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

    if (findError || !user) throw new AppError('User not found.', 404);
    if (user.is_verified)   throw new AppError('Account already verified.', 400);
    if (user.verification_otp !== otp)
        throw new AppError('Invalid OTP.', 400);
    if (new Date(user.verification_otp_expiry) < new Date())
        throw new AppError('OTP has expired. Please request a new one.', 400);

    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
            is_verified: true,
            verification_otp: null,
            verification_otp_expiry: null,
        })
        .eq('id', user.id)
        .select()
        .single();

    if (updateError) throw new AppError('Error verifying account.', 500);

    return updated;
};

/**
 * Login user.
 */
const loginUser = async ({ email, password }) => {
    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

    if (findError || !user || !(await bcrypt.compare(password, user.password))) {
        throw new AppError('Invalid email or password.', 401);
    }
    if (!user.is_verified) {
        throw new AppError('Please verify your email before logging in.', 401);
    }
    if (!user.is_active) {
        throw new AppError('Your account has been deactivated. Contact support.', 403);
    }

    return user;
};

/**
 * Refresh tokens.
 */
const refreshTokens = async (refreshToken) => {
    if (!refreshToken) throw new AppError('Refresh token missing.', 401);

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
        throw new AppError('Invalid or expired refresh token.', 401);
    }

    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .single();

    if (findError || !user || !user.is_active) {
        throw new AppError('User not found or deactivated.', 401);
    }

    return user;
};

/**
 * Forgot password.
 */
const forgotPassword = async (email) => {
    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

    if (findError || !user) throw new AppError('No account found with this email address.', 404);

    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + TOKEN_TTL.OTP).toISOString();

    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
            reset_otp: otp,
            reset_otp_expiry: expiry,
        })
        .eq('id', user.id)
        .select()
        .single();

    if (updateError) throw new AppError('Error setting reset OTP.', 500);

    return { user: updated, otp };
};

/**
 * Reset password.
 */
const resetPassword = async ({ email, otp, newPassword }) => {
    const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

    if (findError || !user)              throw new AppError('User not found.', 404);
    if (user.reset_otp !== otp)          throw new AppError('Invalid OTP.', 400);
    if (new Date(user.reset_otp_expiry) < new Date()) throw new AppError('OTP expired.', 400);

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
            password: hashedPassword,
            reset_otp: null,
            reset_otp_expiry: null,
        })
        .eq('id', user.id)
        .select()
        .single();

    if (updateError) throw new AppError('Error resetting password.', 500);

    return updated;
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
