// backend/controllers/categoryController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const categoryService = require('../services/categoryService');

const getCategories = asyncCatch(async (req, res) => {
    const categories = await categoryService.getCategories();
    res.status(200).json({ success: true, categories });
});

const getCategory = asyncCatch(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.id);
    res.status(200).json({ success: true, category });
});

const createCategory = asyncCatch(async (req, res) => {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json({ success: true, message: 'Category created.', category });
});

const updateCategory = asyncCatch(async (req, res) => {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Category updated.', category });
});

const deleteCategory = asyncCatch(async (req, res) => {
    await categoryService.deleteCategory(req.params.id);
    res.status(200).json({ success: true, message: 'Category deactivated.' });
});

module.exports = { getCategories, getCategory, createCategory, updateCategory, deleteCategory };
