const mongoose = require('mongoose');

const tickerSchema = new mongoose.Schema(
    {
        message: { type: String, required: true },
        isActive: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Ticker', tickerSchema);
