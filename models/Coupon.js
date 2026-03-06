const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, unique: true, uppercase: true, trim: true },
        discount: { type: Number, required: true, min: 1, max: 100 },
        type: { type: String, enum: ['firstOrder', 'global'], required: true },
        expiryDate: { type: Date, required: true },
        usageLimit: { type: Number },
        usedCount: { type: Number, default: 0 },
        minOrderValue: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
