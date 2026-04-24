// backend/services/orderService.js
'use strict';

const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const { ORDER_STATUS, PAYMENT_METHOD } = require('../config/constants');

/**
 * Validate stock availability and enrich items.
 */
const validateAndEnrichItems = async (items) => {
    const enriched = [];

    for (const item of items) {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', item.product)
            .eq('is_active', true)
            .single();

        if (error || !product) {
            throw new AppError(`Product "${item.product}" is not available.`, 400);
        }

        // Check variant-level stock
        if (item.size) {
            const variant = product.variants.find((v) => v.size === item.size);
            if (!variant) throw new AppError(`Size "${item.size}" not available for "${product.title}".`, 400);
            if (variant.stock < item.qty)
                throw new AppError(`Only ${variant.stock} units of "${product.title}" (${item.size}) in stock.`, 400);
        } else {
            if (product.stock < item.qty)
                throw new AppError(`Only ${product.stock} units of "${product.title}" in stock.`, 400);
        }

        enriched.push({
            product_id: product.id,
            name:       product.title,
            image:      product.images?.[0] || '',
            size:       item.size,
            quantity:   item.qty,
            price:      product.sale_price || product.price,
        });
    }

    return enriched;
};

/**
 * Deduct stock after a confirmed order.
 */
const deductStock = async (items) => {
    for (const item of items) {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', item.product_id)
            .single();

        if (error || !product) continue;

        let updatedVariants = [...product.variants];
        let updatedStock = product.stock;

        if (item.size) {
            const variantIndex = updatedVariants.findIndex((v) => v.size === item.size);
            if (variantIndex !== -1) {
                updatedVariants[variantIndex].stock -= item.quantity;
            }
        } else {
            updatedStock = Math.max(0, updatedStock - item.quantity);
        }

        await supabase
            .from('products')
            .update({
                variants: updatedVariants,
                stock: updatedStock,
                sold_count: (product.sold_count || 0) + item.quantity
            })
            .eq('id', product.id);
    }
};

/**
 * Restore stock on cancellation.
 */
const restoreStock = async (items) => {
    for (const item of items) {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', item.product_id)
            .single();

        if (error || !product) continue;

        let updatedVariants = [...product.variants];
        let updatedStock = product.stock;

        if (item.size) {
            const variantIndex = updatedVariants.findIndex((v) => v.size === item.size);
            if (variantIndex !== -1) {
                updatedVariants[variantIndex].stock += item.quantity;
            }
        } else {
            updatedStock += item.quantity;
        }

        await supabase
            .from('products')
            .update({
                variants: updatedVariants,
                stock: updatedStock,
                sold_count: Math.max(0, (product.sold_count || 0) - item.quantity)
            })
            .eq('id', product.id);
    }
};

/**
 * Calculate order totals.
 */
const calcTotals = ({ items, deliveryCharge = 0, couponDiscount = 0, gstPercent = 18 }) => {
    const subtotal   = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const afterCoupon = subtotal - couponDiscount;
    const gstAmount  = +(afterCoupon * (gstPercent / 100)).toFixed(2);
    const totalAmount = +(afterCoupon + gstAmount + deliveryCharge).toFixed(2);

    return { subtotal, gst_amount: gstAmount, gst: gstPercent, delivery_charge: deliveryCharge, coupon_discount: couponDiscount, total_amount: totalAmount };
};

/**
 * Create an order.
 */
const createOrder = async ({ user, items, shippingAddress, paymentMethod, couponCode, deliveryCharge = 0, couponDiscount = 0 }) => {
    const enrichedItems = await validateAndEnrichItems(items);
    const totals = calcTotals({ items: enrichedItems, deliveryCharge, couponDiscount });

    // 1. Generate order number (simple version)
    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const orderNumber = `KDS${String((count || 0) + 1).padStart(6, '0')}`;

    // 2. Create order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
            user_id:         user.id,
            order_number:    orderNumber,
            shipping_address: shippingAddress,
            payment_method:  paymentMethod,
            coupon_code:     couponCode,
            ...totals,
            status_history:  [{ status: ORDER_STATUS.PROCESSING, note: 'Order placed', timestamp: new Date().toISOString() }],
        })
        .select()
        .single();

    if (orderError) throw new AppError('Error creating order.', 500);

    // 3. Create order items
    const orderItems = enrichedItems.map(item => ({
        order_id:   order.id,
        product_id: item.product_id,
        name:       item.name,
        image:      item.image,
        size:       item.size,
        quantity:   item.quantity,
        price:      item.price
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

    if (itemsError) throw new AppError('Error saving order items.', 500);

    // 4. Deduct stock for COD
    if (paymentMethod === PAYMENT_METHOD.COD) {
        await deductStock(enrichedItems);
        // Clear cart
        await supabase.from('cart_items').delete().eq('user_id', user.id);
    }

    return { ...order, items: enrichedItems };
};

/**
 * Get user orders.
 */
const getUserOrders = async (userId, { page = 1, limit = 10 } = {}) => {
    const offset = (page - 1) * limit;

    const { data: orders, count, error } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(title, images))', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new AppError('Error fetching user orders.', 500);

    return { orders, total: count, page, pages: Math.ceil(count / limit) };
};

/**
 * Get single order by ID.
 */
const getOrderById = async (orderId, userId) => {
    const { data: order, error } = await supabase
        .from('orders')
        .select('*, order_items(*, product:products(title, images))')
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

    if (error || !order) throw new AppError('Order not found.', 404);

    return order;
};


/**
 * Get all orders (admin).
 */
const getAllOrders = async ({ page = 1, limit = 20, status, paymentStatus } = {}) => {
    const offset = (page - 1) * limit;

    let sbQuery = supabase
        .from('orders')
        .select('*, user:users(name, email)', { count: 'exact' });

    if (status)        sbQuery = sbQuery.eq('status', status);
    if (paymentStatus) sbQuery = sbQuery.eq('payment_status', paymentStatus);

    const { data: orders, count, error } = await sbQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw new AppError('Error fetching orders.', 500);

    return { orders, total: count, page, pages: Math.ceil(count / limit) };
};

/**
 * Update status.
 */
const updateOrderStatus = async (orderId, { status, note, updatedBy }) => {
    const { data: order, error: findError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (findError || !order) throw new AppError('Order not found.', 404);

    const newHistory = [...(order.status_history || []), { status, note, updated_by: updatedBy, timestamp: new Date().toISOString() }];

    const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({
            status,
            status_history: newHistory
        })
        .eq('id', orderId)
        .select('*, user:users(name, email)')
        .single();

    if (updateError) throw new AppError('Error updating order status.', 500);

    return updated;
};

/**
 * Cancel order.
 */
const cancelOrder = async (orderId, { userId, cancelReason, isAdmin = false }) => {
    let sbQuery = supabase.from('orders').select('*, order_items(*)').eq('id', orderId);
    if (!isAdmin) sbQuery = sbQuery.eq('user_id', userId);

    const { data: order, error: findError } = await sbQuery.single();

    if (findError || !order) throw new AppError('Order not found.', 404);

    const cancellableStatuses = [ORDER_STATUS.PROCESSING, ORDER_STATUS.CONFIRMED];
    if (!cancellableStatuses.includes(order.status)) {
        throw new AppError(`Cannot cancel an order that is already "${order.status}".`, 400);
    }

    const newHistory = [...(order.status_history || []), { status: ORDER_STATUS.CANCELLED, note: cancelReason, timestamp: new Date().toISOString() }];

    const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({
            status:       ORDER_STATUS.CANCELLED,
            cancel_reason: cancelReason || 'Cancelled by user',
            status_history: newHistory
        })
        .eq('id', orderId)
        .select()
        .single();

    if (updateError) throw new AppError('Error cancelling order.', 500);

    // Restore stock
    await restoreStock(order.order_items);

    return updated;
};

module.exports = {
    createOrder,
    validateAndEnrichItems,
    deductStock,
    restoreStock,
    calcTotals,
    getUserOrders,
    getOrderById,
    getAllOrders,
    updateOrderStatus,
    cancelOrder,
};
