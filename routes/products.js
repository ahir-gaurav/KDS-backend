const express = require('express');
const router = express.Router();
const { getProducts, getBestSellers, getCategories, getProduct } = require('../controllers/productController');

router.get('/', getProducts);
router.get('/best-sellers', getBestSellers);
router.get('/categories', getCategories);
router.get('/:id', getProduct);

module.exports = router;
