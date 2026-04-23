// backend/routes/user.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect } = require('../middleware/auth');
const {
    getProfile,
    updateProfile,
    addAddress,
    removeAddress,
} = require('../controllers/userController');

router.use(protect); // All user routes require authentication

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.post('/addresses', addAddress);
router.delete('/addresses/:addressId', removeAddress);

module.exports = router;
