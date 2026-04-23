// backend/routes/cart.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');
const {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
} = require('../controllers/cartController');

router.use(protect);   // All cart routes require authentication

router.get('/',               getCart);
router.post('/',              addToCart);
router.put('/:itemId',        updateCartItem);
router.delete('/:itemId',     removeCartItem);
router.delete('/',            clearCart);

module.exports = router;
