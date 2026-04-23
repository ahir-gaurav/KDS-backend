// backend/routes/admin.js
'use strict';

const express = require('express');
const router  = express.Router();

const { protect }   = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleMiddleware');
const {
    getDashboardStats,
    updateHero,
    updateTicker,
    updateSettings,
} = require('../controllers/adminController');

// All admin routes require admin privileges
router.use(protect, adminOnly);

router.get('/stats', getDashboardStats);
router.post('/hero', updateHero);
router.post('/ticker', updateTicker);
router.post('/settings', updateSettings);

module.exports = router;
