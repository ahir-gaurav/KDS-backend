const express = require('express');
const router = express.Router();
const { createOrder, getMyOrders, getOrder } = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/:id', getOrder);

module.exports = router;
