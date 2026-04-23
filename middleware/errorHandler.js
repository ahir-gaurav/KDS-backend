// backend/middleware/errorHandler.js
'use strict';

const AppError = require('../utils/AppError');

// ── Mongoose-specific error transformers ──────────────────────────────────────

const handleCastError = (err) =>
    new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue)[0];
    return new AppError(`Duplicate value for field: "${field}". Please use a different value.`, 400);
};

const handleValidationError = (err) => {
    const messages = Object.values(err.errors).map((e) => e.message);
    return new AppError(`Validation error: ${messages.join('. ')}`, 400);
};

const handleJWTError = () =>
    new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () =>
    new AppError('Your token has expired. Please log in again.', 401);

// ── Response senders ──────────────────────────────────────────────────────────

const sendDevError = (err, res) => {
    res.status(err.statusCode).json({
        success:   false,
        status:    err.status,
        message:   err.message,
        stack:     err.stack,
        error:     err,
    });
};

const sendProdError = (err, res) => {
    if (err.isOperational) {
        // Trusted operational error — safe to expose to client
        res.status(err.statusCode).json({
            success: false,
            status:  err.status,
            message: err.message,
        });
    } else {
        // Programming / unknown error — don't leak details
        console.error('💥 UNHANDLED ERROR:', err);
        res.status(500).json({
            success: false,
            status:  'error',
            message: 'Something went wrong. Please try again later.',
        });
    }
};

// ── Global error handler middleware ───────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status     = err.status     || 'error';

    if (process.env.NODE_ENV === 'development') {
        return sendDevError(err, res);
    }

    // Production: convert known Mongoose/JWT errors into AppErrors
    let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
    error.message = err.message;

    if (error.name === 'CastError')                 error = handleCastError(error);
    if (error.code  === 11000)                      error = handleDuplicateKeyError(error);
    if (error.name === 'ValidationError')           error = handleValidationError(error);
    if (error.name === 'JsonWebTokenError')         error = handleJWTError();
    if (error.name === 'TokenExpiredError')         error = handleJWTExpiredError();

    sendProdError(error, res);
};

module.exports = errorHandler;
