// backend/middleware/requestLogger.js
'use strict';

/**
 * Lightweight request logger middleware.
 * Logs method, URL, status, duration, and user ID (if authenticated).
 * In production you can replace the console.log with a Winston/Pino stream.
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const userId   = req.user?._id || 'guest';
        const level    = res.statusCode >= 500 ? '❌' :
                         res.statusCode >= 400 ? '⚠️ ' : '✅';

        console.log(
            `${level} ${new Date().toISOString()} | ${req.method} ${req.originalUrl}` +
            ` | ${res.statusCode} | ${duration}ms | user:${userId}`
        );
    });

    next();
};

module.exports = requestLogger;
