// backend/controllers/categoryController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const Category   = require('../models/Category');

// ── GET /api/categories ───────────────────────────────────────────────────────
const getCategories = asyncCatch(async (req, res) => {
    const categories = await Category.find({ isActive: true })
        .sort({ order: 1, name: 1 })
        .populate('parent', 'name slug');
    res.status(200).json({ success: true, categories });
});

// ── GET /api/categories/:id ───────────────────────────────────────────────────
const getCategory = asyncCatch(async (req, res) => {
    const category = await Category.findById(req.params.id).populate('parent', 'name slug');
    if (!category) throw new AppError('Category not found.', 404);
    res.status(200).json({ success: true, category });
});

// ── POST /api/categories (admin) ──────────────────────────────────────────────
const createCategory = asyncCatch(async (req, res) => {
    const category = await Category.create(req.body);
    res.status(201).json({ success: true, message: 'Category created.', category });
});

// ── PUT /api/categories/:id (admin) ───────────────────────────────────────────
const updateCategory = asyncCatch(async (req, res) => {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
        new: true, runValidators: true,
    });
    if (!category) throw new AppError('Category not found.', 404);
    res.status(200).json({ success: true, message: 'Category updated.', category });
});

// ── DELETE /api/categories/:id (admin) ────────────────────────────────────────
const deleteCategory = asyncCatch(async (req, res) => {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) throw new AppError('Category not found.', 404);
    res.status(200).json({ success: true, message: 'Category deactivated.' });
});

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
