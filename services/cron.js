// backend/services/cron.js
'use strict';

const cron = require('node-cron');
const supabase = require('../config/supabase');
const { sendMonthlySalesReport } = require('./email');

const generateMonthlyReport = async () => {
    try {
        const now = new Date();
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

        const monthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .gte('created_at', firstDayLastMonth)
            .lte('created_at', lastDayLastMonth);

        if (ordersError) throw ordersError;

        const totalOrders = orders.length;
        const totalRevenue = orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total_amount), 0);
        const totalUnitsSold = orders.reduce((sum, o) => sum + o.order_items.reduce((s, p) => s + p.quantity, 0), 0);
        const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
        const pendingOrders = orders.filter(o => o.status === 'processing').length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        const { count: newCustomers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'user')
            .gte('created_at', firstDayLastMonth)
            .lte('created_at', lastDayLastMonth);

        // Aggregate product sales
        const productSales = {};
        for (const order of orders) {
            for (const item of order.order_items) {
                const pid = item.product_id;
                if (!productSales[pid]) {
                    productSales[pid] = { name: item.name, sold: 0, revenue: 0 };
                }
                productSales[pid].sold += item.quantity;
                productSales[pid].revenue += item.quantity * Number(item.price);
            }
        }

        const sortedProducts = Object.values(productSales).sort((a, b) => b.sold - a.sold);
        const topProducts = sortedProducts.slice(0, 5);
        const worstProducts = sortedProducts.slice(-5).reverse();

        const report = {
            month: monthName,
            totalOrders,
            totalRevenue,
            totalUnitsSold,
            cancelledOrders,
            pendingOrders,
            avgOrderValue,
            newCustomers: newCustomers || 0,
            topProducts,
            worstProducts,
        };

        const { data: admins } = await supabase
            .from('users')
            .select('email')
            .eq('role', 'admin');

        const adminEmails = admins?.map(a => a.email) || [];

        if (adminEmails.length > 0) {
            await sendMonthlySalesReport(adminEmails, report);
            console.log(`Monthly report sent to ${adminEmails.join(', ')}`);
        }
    } catch (error) {
        console.error('Monthly report cron error:', error.message);
    }
};

const startCronJobs = () => {
    // Run at midnight on the 1st of every month
    cron.schedule('0 0 1 * *', generateMonthlyReport, {
        timezone: 'Asia/Kolkata',
    });
    console.log('Cron jobs started: Monthly sales report scheduled');
};

module.exports = { startCronJobs };
