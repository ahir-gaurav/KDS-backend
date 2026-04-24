// backend/middleware/auth.js
'use strict';

const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const asyncCatch = require('../utils/asyncCatch');

/**
 * protect — verify JWT (from httpOnly cookie OR Authorization header).
 */
const protect = asyncCatch(async (req, res, next) => {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return next(new AppError('Not authenticated. Please log in.', 401));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .single();

    if (error || !user) return next(new AppError('User no longer exists.', 401));
    if (!user.is_active) return next(new AppError('Your account has been deactivated.', 403));

    req.user = user;
    next();
});

/**
 * optionalAuth — same as protect but doesn't reject if no token present.
 */
const optionalAuth = asyncCatch(async (req, res, next) => {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.id)
            .single();
        req.user = user;
    } catch {
        // Invalid token — proceed as guest
    }
    next();
});

module.exports = { protect, optionalAuth };
