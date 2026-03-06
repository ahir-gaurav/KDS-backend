const cron = require('node-cron');
const Order = require('../models/Order');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const { sendMonthlySalesReport } = require('./email');

const generateMonthlyReport = async () => {
    try {
        const now = new Date();
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        const monthName = firstDayLastMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

        const orders = await Order.find({
            createdAt: { $gte: firstDayLastMonth, $lte: lastDayLastMonth },
        }).populate('products.product');

        const totalOrders = orders.length;
        const totalRevenue = orders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.totalPrice, 0);
        const totalUnitsSold = orders.reduce((sum, o) => sum + o.products.reduce((s, p) => s + p.quantity, 0), 0);
        const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;
        const pendingOrders = orders.filter(o => o.status === 'Processing').length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        const newCustomers = await User.countDocuments({
            createdAt: { $gte: firstDayLastMonth, $lte: lastDayLastMonth },
        });

        // Aggregate product sales
        const productSales = {};
        for (const order of orders) {
            for (const item of order.products) {
                const pid = item.product?._id?.toString() || item.product?.toString();
                if (!productSales[pid]) {
                    productSales[pid] = { name: item.name, sold: 0, revenue: 0 };
                }
                productSales[pid].sold += item.quantity;
                productSales[pid].revenue += item.quantity * item.price;
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
            newCustomers,
            topProducts,
            worstProducts,
        };

        const admins = await Admin.find({});
        const adminEmails = admins.map(a => a.email);

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
