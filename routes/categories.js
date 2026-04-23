// backend/routes/categories.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect }   = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleMiddleware');
const {
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
} = require('../controllers/categoryController');

// Public
router.get('/',    getCategories);
router.get('/:id', getCategory);

// Admin only
router.post('/',      protect, adminOnly, createCategory);
router.put('/:id',    protect, adminOnly, updateCategory);
router.delete('/:id', protect, adminOnly, deleteCategory);

module.exports = router;
