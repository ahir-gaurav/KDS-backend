// backend/routes/reviews.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect }        = require('../middleware/auth');
const { restrictTo }     = require('../middleware/roleMiddleware');
const { ROLES }          = require('../config/constants');
const {
    createReview,
    getProductReviews,
    updateReview,
    deleteReview,
} = require('../controllers/reviewController');

// Public
router.get('/product/:productId', getProductReviews);

// Authenticated users
router.post('/',        protect, createReview);
router.put('/:id',      protect, updateReview);

// User (own) or admin can delete
router.delete('/:id',   protect, deleteReview);

module.exports = router;
