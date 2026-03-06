const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
    {
        gst: { type: Number, default: 18 },
        deliveryCharge: { type: Number, default: 80 },
        freeDeliveryThreshold: { type: Number, default: 2000 },
        lowStockThreshold: { type: Number, default: 5 },
        razorpayMode: { type: String, enum: ['test', 'live'], default: 'test' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
