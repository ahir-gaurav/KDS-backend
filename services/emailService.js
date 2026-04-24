// backend/services/emailService.js
'use strict';

/**
 * Thin facade over the existing services/email.js.
 * Re-exports all email senders under a consistent `emailService` namespace
 * and adds a generic sendEmail primitive for convenience.
 *
 * New email templates should be added here, not in email.js,
 * so that email.js can stay focused on transport config.
 */

const {
    sendWelcomeOTP,
    sendPasswordResetOTP,
    sendOrderConfirmation,
    sendOrderShipped,
    sendOrderDelivered,
    sendOrderCancelled,
    sendPaymentFailed,
    sendCouponApplied,
    sendMonthlySalesReport,
} = require('./email');

const nodemailer = require('nodemailer');

const createTransporter = () =>
    nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
            user: process.env.BREVO_SENDER_EMAIL,
            pass: process.env.BREVO_API_KEY,
        },
    });

/** Generic send — used internally when a pre-built template isn't available */
const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"KDS Store" <${process.env.BREVO_SENDER_EMAIL}>`,
            to,
            subject,
            html,
            text,
        });
    } catch (err) {
        console.error('📧 Email error:', err.message);
        // Don't throw — email failures should not block order flow
    }
};

/** Send order review request after delivery */
const sendReviewRequest = async (user, order) => {
    const productLinks = order.items
        .map(
            (i) =>
                `<li style="margin-bottom:8px;"><a href="${process.env.FRONTEND_URL}/products/${i.product_id || i.product}" style="color:#D9A441;">${i.name}</a></li>`
        )
        .join('');

    await sendEmail({
        to: user.email,
        subject: `How was your order? — KDS`,
        html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#F4F1EA;padding:40px;">
        <h1 style="color:#D9A441;font-weight:900;">KICKS DON'T STINK</h1>
        <h2>⭐ We'd love your feedback!</h2>
        <p>Hi ${user.name}, your order <strong>#${order.order_number || order.orderNumber}</strong> has been delivered.</p>
        <p>Share your thoughts on:</p>
        <ul>${productLinks}</ul>
      </div>
    `,
    });
};

module.exports = {
    // Re-exports from email.js
    sendWelcomeOTP,
    sendPasswordResetOTP,
    sendOrderConfirmation,
    sendOrderShipped,
    sendOrderDelivered,
    sendOrderCancelled,
    sendPaymentFailed,
    sendCouponApplied,
    sendMonthlySalesReport,

    // New / extended
    sendEmail,
    sendReviewRequest,
};
