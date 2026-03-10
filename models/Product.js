const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    size: { type: String, required: true },
    stock: { type: Number, required: true, default: 0 },
    sku: { type: String },
});

const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true },
        salePrice: { type: Number },
        category: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        images: [{ type: String }],
        variants: [variantSchema],
        stock: { type: Number, default: 0 },
        soldCount: { type: Number, default: 0 },
        tags: [{ type: String, enum: ['Best Seller', 'New Drop', 'Limited Edition'] }],
        isActive: { type: Boolean, default: true },
        // Offer & Pricing fields
        mrp: { type: Number },
        sellingPrice: { type: Number },
        discountPercent: { type: Number, default: 0, min: 0, max: 90 },
        isOfferActive: { type: Boolean, default: false },
        offerLabel: { type: String, trim: true },
    },
    { timestamps: true }
);

productSchema.index({ name: 'text', category: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);
