// backend/utils/helpers.js
'use strict';

/**
 * Generate a 6-digit numeric OTP.
 */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Build a consistent success response shape.
 */
const successResponse = (res, data = {}, message = 'Success', statusCode = 200) =>
    res.status(statusCode).json({ success: true, message, ...data });

/**
 * Convert amount from rupees to paise (Razorpay expects paise).
 */
const toPaise = (rupees) => Math.round(rupees * 100);

/**
 * Pick only whitelisted keys from an object (safe partial update helper).
 */
const pick = (obj, keys) =>
    keys.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(obj, key)) acc[key] = obj[key];
        return acc;
    }, {});

module.exports = { generateOTP, successResponse, toPaise, pick };
