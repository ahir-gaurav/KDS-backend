// backend/utils/asyncCatch.js
'use strict';

/**
 * Wraps an async Express route handler and forwards thrown errors to next().
 * Eliminates repetitive try/catch blocks in every controller.
 *
 * Usage:
 *   router.get('/example', asyncCatch(async (req, res) => {
 *       const data = await SomeService.getData();
 *       res.json(data);
 *   }));
 *
 * @param {Function} fn - Async route handler
 * @returns {Function} Express middleware
 */
const asyncCatch = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncCatch;
