// backend/utils/AppError.js
'use strict';

/**
 * Custom operational error class.
 * `isOperational = true` marks errors we deliberately throw (vs. programming bugs).
 * The global error handler uses this flag to decide whether to expose details.
 */
class AppError extends Error {
    /**
     * @param {string} message   - Human-readable error message
     * @param {number} statusCode - HTTP status code (e.g. 400, 404, 401)
     */
    constructor(message, statusCode) {
        super(message);
        this.statusCode    = statusCode;
        this.status        = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
