// backend/controllers/cartController.js
'use strict';

const asyncCatch = require('../utils/asyncCatch');
const AppError   = require('../utils/AppError');
const supabase   = require('../config/supabase');

// ── GET /api/cart ─────────────────────────────────────────────────────────────
const getCart = asyncCatch(async (req, res) => {
    const { data: items, error } = await supabase
        .from('cart_items')
        .select('*, product:products(*)')
        .eq('user_id', req.user.id);

    if (error) throw new AppError('Error fetching cart.', 500);

    res.status(200).json({ success: true, cart: { items: items || [], total: 0 } });
});

// ── POST /api/cart ─────────────────────────────────────────────────────────────
const addToCart = asyncCatch(async (req, res) => {
    const { productId, qty = 1, size } = req.body;
    if (!productId) throw new AppError('Product ID is required.', 400);

    const { data: product, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('is_active', true)
        .single();

    if (prodError || !product) throw new AppError('Product not found.', 404);

    // Stock check
    const availableStock = size
        ? product.variants.find((v) => v.size === size)?.stock ?? 0
        : product.stock;
    if (qty > availableStock) throw new AppError(`Only ${availableStock} units available.`, 400);

    // Check if item already in cart
    let sbQuery = supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('product_id', productId);
    
    if (size) sbQuery = sbQuery.eq('size', size);
    else sbQuery = sbQuery.is('size', null);

    const { data: existing, error: findError } = await sbQuery.single();

    if (existing) {
        const { data: updated, error: updateError } = await supabase
            .from('cart_items')
            .update({ quantity: existing.quantity + qty })
            .eq('id', existing.id)
            .select('*, product:products(*)')
            .single();
        if (updateError) throw new AppError('Error updating cart.', 500);
        return res.status(200).json({ success: true, message: 'Cart updated.', cart: { items: [updated] } });
    }

    const { data: newItem, error: createError } = await supabase
        .from('cart_items')
        .insert({
            user_id: req.user.id,
            product_id: productId,
            quantity: qty,
            size
        })
        .select('*, product:products(*)')
        .single();

    if (createError) throw new AppError('Error adding to cart.', 500);

    res.status(200).json({ success: true, message: 'Item added to cart.', cart: { items: [newItem] } });
});

// ── PUT /api/cart/:itemId ──────────────────────────────────────────────────────
const updateCartItem = asyncCatch(async (req, res) => {
    const { qty } = req.body;
    if (!qty || qty < 1) throw new AppError('Quantity must be at least 1.', 400);

    const { data: updated, error } = await supabase
        .from('cart_items')
        .update({ quantity: qty })
        .eq('id', req.params.itemId)
        .eq('user_id', req.user.id)
        .select('*, product:products(*)')
        .single();

    if (error || !updated) throw new AppError('Cart item not found.', 404);

    res.status(200).json({ success: true, message: 'Cart updated.', cart: { items: [updated] } });
});

// ── DELETE /api/cart/:itemId ──────────────────────────────────────────────────
const removeCartItem = asyncCatch(async (req, res) => {
    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', req.params.itemId)
        .eq('user_id', req.user.id);

    if (error) throw new AppError('Error removing item.', 500);

    res.status(200).json({ success: true, message: 'Item removed.' });
});

// ── DELETE /api/cart ──────────────────────────────────────────────────────────
const clearCart = asyncCatch(async (req, res) => {
    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', req.user.id);

    if (error) throw new AppError('Error clearing cart.', 500);

    res.status(200).json({ success: true, message: 'Cart cleared.' });
});

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };
