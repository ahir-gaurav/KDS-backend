// backend/middleware/auth.js
'use strict';

const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const AppError = require('../utils/AppError');
const asyncCatch = require('../utils/asyncCatch');

/**
 * protect — verify JWT (from httpOnly cookie OR Authorization header).
 * Attaches the full user document to req.user.
 */
const protect = asyncCatch(async (req, res, next) => {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return next(new AppError('Not authenticated. Please log in.', 401));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user)          return next(new AppError('User no longer exists.', 401));
    if (!user.isActive) return next(new AppError('Your account has been deactivated.', 403));

    req.user = user;
    next();
});

/**
 * optionalAuth — same as protect but doesn't reject if no token present.
 * Useful for public routes that have different behaviour for logged-in users.
 */
const optionalAuth = asyncCatch(async (req, res, next) => {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id);
    } catch {
        // Invalid token — proceed as guest
    }
    next();
});

module.exports = { protect, optionalAuth };
