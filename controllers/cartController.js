// backend/controllers/cartController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const Cart       = require('../models/Cart');
const Product    = require('../models/Product');

// ── GET /api/cart ─────────────────────────────────────────────────────────────
const getCart = asyncCatch(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id })
        .populate('items.product', 'title images price salePrice isActive stock variants');

    res.status(200).json({ success: true, cart: cart || { items: [], total: 0 } });
});

// ── POST /api/cart ─────────────────────────────────────────────────────────────
const addToCart = asyncCatch(async (req, res) => {
    const { productId, qty = 1, size } = req.body;
    if (!productId) throw new AppError('Product ID is required.', 400);

    const product = await Product.findById(productId);
    if (!product || !product.isActive) throw new AppError('Product not found.', 404);

    // Stock check
    const availableStock = size
        ? product.variants.find((v) => v.size === size)?.stock ?? 0
        : product.stock;
    if (qty > availableStock) throw new AppError(`Only ${availableStock} units available.`, 400);

    const price = product.salePrice || product.price;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const existingIdx = cart.items.findIndex(
        (i) => i.product.toString() === productId && i.size === size
    );

    if (existingIdx >= 0) {
        cart.items[existingIdx].qty += qty;
    } else {
        cart.items.push({ product: productId, qty, price, size });
    }

    await cart.save();
    await cart.populate('items.product', 'title images price salePrice');
    res.status(200).json({ success: true, message: 'Item added to cart.', cart });
});

// ── PUT /api/cart/:itemId ──────────────────────────────────────────────────────
const updateCartItem = asyncCatch(async (req, res) => {
    const { qty } = req.body;
    if (!qty || qty < 1) throw new AppError('Quantity must be at least 1.', 400);

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw new AppError('Cart not found.', 404);

    const item = cart.items.id(req.params.itemId);
    if (!item) throw new AppError('Cart item not found.', 404);

    item.qty = qty;
    await cart.save();
    res.status(200).json({ success: true, message: 'Cart updated.', cart });
});

// ── DELETE /api/cart/:itemId ──────────────────────────────────────────────────
const removeCartItem = asyncCatch(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) throw new AppError('Cart not found.', 404);

    cart.items = cart.items.filter((i) => i._id.toString() !== req.params.itemId);
    await cart.save();
    res.status(200).json({ success: true, message: 'Item removed.', cart });
});

// ── DELETE /api/cart ──────────────────────────────────────────────────────────
const clearCart = asyncCatch(async (req, res) => {
    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
    res.status(200).json({ success: true, message: 'Cart cleared.' });
});

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };
