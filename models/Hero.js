const mongoose = require('mongoose');

const heroSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        subtitle: { type: String },
        image: { type: String, required: true },
        buttonText: { type: String, default: 'SHOP NOW' },
        buttonLink: { type: String, default: '/products' },
        displayOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Hero', heroSchema);
