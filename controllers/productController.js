// backend/controllers/productController.js
'use strict';

const asyncCatch    = require('../utils/asyncCatch');
const AppError      = require('../utils/AppError');
const productService = require('../services/productService');

// ── GET /api/products ─────────────────────────────────────────────────────────
const getProducts = asyncCatch(async (req, res) => {
    const result = await productService.getProducts(req.query);
    res.status(200).json({ success: true, ...result });
});

// ── GET /api/products/search ──────────────────────────────────────────────────
const searchProducts = asyncCatch(async (req, res) => {
    const result = await productService.searchProducts(req.query);
    res.status(200).json({ success: true, ...result });
});

// ── GET /api/products/featured ────────────────────────────────────────────────
const getFeaturedProducts = asyncCatch(async (req, res) => {
    const limit    = parseInt(req.query.limit) || 8;
    const products = await productService.getFeaturedProducts(limit);
    res.status(200).json({ success: true, products });
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────
const getProduct = asyncCatch(async (req, res) => {
    const product = await productService.getProductByIdOrSlug(req.params.id);
    res.status(200).json({ success: true, product });
});

// ── POST /api/products ────────────────────────────────────────────────────────
const createProduct = asyncCatch(async (req, res) => {
    const product = await productService.createProduct(req.body);
    res.status(201).json({ success: true, message: 'Product created.', product });
});

// ── PUT /api/products/:id ─────────────────────────────────────────────────────
const updateProduct = asyncCatch(async (req, res) => {
    const product = await productService.updateProduct(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Product updated.', product });
});

// ── DELETE /api/products/:id ──────────────────────────────────────────────────
const deleteProduct = asyncCatch(async (req, res) => {
    await productService.deleteProduct(req.params.id);
    res.status(200).json({ success: true, message: 'Product deactivated.' });
});

module.exports = { getProducts, searchProducts, getFeaturedProducts, getProduct, createProduct, updateProduct, deleteProduct };
