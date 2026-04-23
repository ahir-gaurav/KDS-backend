// backend/config/db.js
'use strict';

const mongoose = require('mongoose');

const MAX_RETRIES  = 5;
const RETRY_DELAY  = 5000; // ms

const connectDB = async (retries = MAX_RETRIES) => {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.warn('⚠️  MONGODB_URI missing — database features unavailable.');
        return;
    }

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log(`✅ MongoDB connected: ${conn.connection.host}`);

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected. Attempting reconnect…');
            setTimeout(() => connectDB(MAX_RETRIES), RETRY_DELAY);
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB error:', err.message);
        });

    } catch (err) {
        console.error(`❌ MongoDB connection failed (${MAX_RETRIES - retries + 1}/${MAX_RETRIES}):`, err.message);

        if (retries > 1) {
            console.log(`   Retrying in ${RETRY_DELAY / 1000}s…`);
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
            return connectDB(retries - 1);
        }

        console.error('   Max retries reached. Continuing without MongoDB.');
    }
};

module.exports = connectDB;
