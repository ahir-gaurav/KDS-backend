// backend/routes/orders.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect }    = require('../middleware/auth');
const { adminOnly }  = require('../middleware/roleMiddleware');
const {
    placeOrder,
    getMyOrders,
    getOrder,
    cancelOrder,
    getAllOrders,
    updateOrderStatus,
    adminCancelOrder,
} = require('../controllers/orderController');

// User — protected
router.post('/',                protect, placeOrder);
router.get('/my',               protect, getMyOrders);
router.get('/:id',              protect, getOrder);
router.post('/:id/cancel',      protect, cancelOrder);

// Admin — protected + adminOnly
router.get('/',                 protect, adminOnly, getAllOrders);
router.put('/:id/status',       protect, adminOnly, updateOrderStatus);
router.delete('/:id',           protect, adminOnly, adminCancelOrder);

module.exports = router;
