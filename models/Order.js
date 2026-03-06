const mongoose = require('mongoose');

const orderProductSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String },
    size: { type: String },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
});

const statusHistorySchema = new mongoose.Schema({
    status: { type: String },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
});

const orderSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        orderNumber: { type: String, unique: true },
        products: [orderProductSchema],
        subtotal: { type: Number, required: true },
        gst: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        deliveryCharge: { type: Number, default: 0 },
        couponCode: { type: String },
        couponDiscount: { type: Number, default: 0 },
        totalPrice: { type: Number, required: true },
        deliveryAddress: {
            fullName: String,
            phone: String,
            addressLine1: String,
            addressLine2: String,
            city: String,
            state: String,
            pincode: String,
        },
        paymentMethod: { type: String, enum: ['razorpay', 'cod'], required: true },
        paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },
        status: {
            type: String,
            enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
            default: 'Processing',
        },
        statusHistory: [statusHistorySchema],
        trackingInfo: { type: String },
        cancelReason: { type: String },
        refundStatus: { type: String, enum: ['none', 'initiated', 'completed'], default: 'none' },
    },
    { timestamps: true }
);

orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = `KDS${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

orderSchema.index({ user: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);
