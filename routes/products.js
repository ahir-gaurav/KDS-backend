// backend/routes/products.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect }   = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleMiddleware');
const { searchLimiter } = require('../middleware/rateLimiter');
const {
    getProducts,
    searchProducts,
    getFeaturedProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
} = require('../controllers/productController');

// Public
router.get('/',         getProducts);
router.get('/search',   searchLimiter, searchProducts);
router.get('/featured', getFeaturedProducts);
router.get('/:id',      getProduct);

// Admin only
router.post('/',       protect, adminOnly, createProduct);
router.put('/:id',     protect, adminOnly, updateProduct);
router.delete('/:id',  protect, adminOnly, deleteProduct);

module.exports = router;
