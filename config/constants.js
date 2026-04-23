// backend/config/constants.js
'use strict';

// ── Order lifecycle ───────────────────────────────────────────────────────────
const ORDER_STATUS = Object.freeze({
    PROCESSING: 'Processing',
    CONFIRMED:  'Confirmed',
    SHIPPED:    'Shipped',
    OUT_FOR_DELIVERY: 'Out for Delivery',
    DELIVERED:  'Delivered',
    CANCELLED:  'Cancelled',
    RETURNED:   'Returned',
});

// ── Payment states ────────────────────────────────────────────────────────────
const PAYMENT_STATUS = Object.freeze({
    PENDING:   'pending',
    PAID:      'paid',
    FAILED:    'failed',
    REFUNDED:  'refunded',
    PARTIAL:   'partial',
});

// ── Payment methods ───────────────────────────────────────────────────────────
const PAYMENT_METHOD = Object.freeze({
    RAZORPAY: 'razorpay',
    COD:      'cod',
    STRIPE:   'stripe',
});

// ── User / admin roles ────────────────────────────────────────────────────────
const ROLES = Object.freeze({
    USER:       'user',
    ADMIN:      'admin',
    SUPERADMIN: 'superadmin',
});

// ── Refund states ─────────────────────────────────────────────────────────────
const REFUND_STATUS = Object.freeze({
    NONE:      'none',
    INITIATED: 'initiated',
    COMPLETED: 'completed',
    FAILED:    'failed',
});

// ── Product tags ──────────────────────────────────────────────────────────────
const PRODUCT_TAGS = Object.freeze(['Best Seller', 'New Drop', 'Limited Edition', 'Sale']);

// ── Pagination defaults ───────────────────────────────────────────────────────
const PAGINATION = Object.freeze({
    DEFAULT_PAGE:  1,
    DEFAULT_LIMIT: 12,
    MAX_LIMIT:     100,
});

// ── Token TTLs (ms) ───────────────────────────────────────────────────────────
const TOKEN_TTL = Object.freeze({
    ACCESS:  7  * 24 * 60 * 60 * 1000,  // 7 days
    REFRESH: 30 * 24 * 60 * 60 * 1000,  // 30 days
    OTP:     10 * 60 * 1000,             // 10 minutes
});

module.exports = {
    ORDER_STATUS,
    PAYMENT_STATUS,
    PAYMENT_METHOD,
    ROLES,
    REFUND_STATUS,
    PRODUCT_TAGS,
    PAGINATION,
    TOKEN_TTL,
};
