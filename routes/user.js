const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, addAddress, updateAddress, deleteAddress } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/addresses', addAddress);
router.put('/addresses/:addressId', updateAddress);
router.delete('/addresses/:addressId', deleteAddress);

module.exports = router;
