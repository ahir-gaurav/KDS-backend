const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const Coupon = require('../models/Coupon');
const razorpay = require('../config/razorpay');
const {
    sendOrderConfirmation,
    sendOrderShipped,
    sendOrderDelivered,
    sendOrderCancelled,
    sendPaymentFailed,
} = require('../services/email');

// POST /api/orders
const createOrder = async (req, res) => {
    try {
        const { products, deliveryAddress, paymentMethod, couponCode } = req.body;
        const settings = (await Settings.findOne()) || {};
        const gstRate = settings.gst || 18;
        const deliveryFee = settings.deliveryCharge || 80;
        const freeDeliveryThreshold = settings.freeDeliveryThreshold || 2000;

        // Validate and calculate subtotal
        let subtotal = 0;
        const orderProducts = [];
        for (const item of products) {
            const product = await Product.findById(item.productId);
            if (!product) return res.status(404).json({ message: `Product not found: ${item.productId}` });
            const price = product.salePrice || product.price;
            orderProducts.push({
                product: product._id,
                name: product.name,
                image: product.images[0] || '',
                size: item.size,
                quantity: item.quantity,
                price,
            });
            subtotal += price * item.quantity;
        }

        let couponDiscount = 0;
        let appliedCoupon = null;
        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
            if (coupon && coupon.expiryDate >= new Date() && subtotal >= coupon.minOrderValue) {
                if (coupon.type === 'firstOrder') {
                    const prevOrders = await Order.countDocuments({ user: req.user._id });
                    if (prevOrders === 0) {
                        couponDiscount = Math.round((subtotal * coupon.discount) / 100);
                        appliedCoupon = coupon;
                    }
                } else {
                    couponDiscount = Math.round((subtotal * coupon.discount) / 100);
                    appliedCoupon = coupon;
                }
            }
        }

        const discountedSubtotal = subtotal - couponDiscount;
        const delivery = discountedSubtotal >= freeDeliveryThreshold ? 0 : deliveryFee;
        const gstAmount = Math.round((discountedSubtotal * gstRate) / 100);
        const totalPrice = discountedSubtotal + gstAmount + delivery;

        const order = new Order({
            user: req.user._id,
            products: orderProducts,
            subtotal,
            gst: gstRate,
            gstAmount,
            deliveryCharge: delivery,
            couponCode: couponCode || undefined,
            couponDiscount,
            totalPrice,
            deliveryAddress,
            paymentMethod,
            paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
            status: 'Processing',
            statusHistory: [{ status: 'Processing', timestamp: new Date() }],
        });

        if (paymentMethod === 'razorpay') {
            const rzpOrder = await razorpay.orders.create({
                amount: totalPrice * 100,
                currency: 'INR',
                receipt: `order_${Date.now()}`,
            });
            order.razorpayOrderId = rzpOrder.id;
        }

        await order.save();

        // Update user orders array
        await req.user.updateOne({ $push: { orders: order._id } });

        // Update sold counts
        for (const item of orderProducts) {
            await Product.findByIdAndUpdate(item.product, { $inc: { soldCount: item.quantity } });
        }

        // Update coupon usage
        if (appliedCoupon) {
            appliedCoupon.usedCount += 1;
            appliedCoupon.usedBy.push(req.user._id);
            await appliedCoupon.save();
        }

        // Send confirmation for COD
        if (paymentMethod === 'cod') {
            await sendOrderConfirmation(req.user, order);
        }

        res.status(201).json({
            order,
            razorpayOrderId: order.razorpayOrderId,
            totalPrice,
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// GET /api/orders/my
const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json({ orders });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/orders/:id
const getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        res.json({ order });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: GET /api/admin/orders
const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const query = status ? { status } : {};
        const total = await Order.countDocuments(query);
        const orders = await Order.find(query)
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));
        res.json({ orders, total });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin: PUT /api/admin/orders/:id/status
const updateOrderStatus = async (req, res) => {
    try {
        const { status, trackingInfo, cancelReason } = req.body;
        const order = await Order.findById(req.params.id).populate('user');
        if (!order) return res.status(404).json({ message: 'Order not found' });

        order.status = status;
        order.statusHistory.push({ status, timestamp: new Date() });
        if (trackingInfo) order.trackingInfo = trackingInfo;
        if (cancelReason) order.cancelReason = cancelReason;

        await order.save();

        // Send email based on new status
        const user = order.user;
        if (status === 'Shipped') await sendOrderShipped(user, order);
        else if (status === 'Delivered') await sendOrderDelivered(user, order);
        else if (status === 'Cancelled') await sendOrderCancelled(user, order);

        res.json({ order });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { createOrder, getMyOrders, getOrder, getAllOrders, updateOrderStatus };
