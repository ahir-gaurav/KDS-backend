// backend/middleware/roleMiddleware.js
'use strict';

const AppError = require('../utils/AppError');
const { ROLES }  = require('../config/constants');

/**
 * restrictTo(...roles) — factory that returns middleware allowing only the
 * specified roles. Must be used AFTER the `protect` middleware.
 *
 * Usage:
 *   router.delete('/product/:id', protect, restrictTo(ROLES.ADMIN), deleteProduct);
 */
const restrictTo = (...roles) => (req, _res, next) => {
    if (!req.user) {
        return next(new AppError('You must be logged in.', 401));
    }
    if (!roles.includes(req.user.role)) {
        return next(
            new AppError('You do not have permission to perform this action.', 403)
        );
    }
    next();
};

/**
 * Shorthand helpers (re-export for convenience)
 */
const adminOnly      = restrictTo(ROLES.ADMIN, ROLES.SUPERADMIN);
const superAdminOnly = restrictTo(ROLES.SUPERADMIN);

module.exports = { restrictTo, adminOnly, superAdminOnly };
