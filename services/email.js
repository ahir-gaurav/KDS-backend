const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
            user: process.env.BREVO_SENDER_EMAIL,
            pass: process.env.BREVO_API_KEY,
        },
    });
};

const sendEmail = async ({ to, subject, html }) => {
    try {
        const transporter = createTransporter();
        await transporter.sendMail({
            from: `"Kicks Don't Stink" <${process.env.BREVO_SENDER_EMAIL}>`,
            to,
            subject,
            html,
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('Email send error:', error.message);
    }
};

const sendWelcomeOTP = async (user, otp) => {
    await sendEmail({
        to: user.email,
        subject: "Verify Your Email — Kicks Don't Stink",
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441; margin-bottom: 8px;">KICKS DON'T STINK</h1>
        <h2 style="font-size: 24px; margin-bottom: 24px;">Welcome, ${user.name}! 👟</h2>
        <p style="color: #ccc; margin-bottom: 24px;">Your verification OTP is:</p>
        <div style="background: #2F3B2F; padding: 24px; text-align: center; border-radius: 8px; margin-bottom: 24px;">
          <span style="font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #D9A441;">${otp}</span>
        </div>
        <p style="color: #999; font-size: 14px;">This OTP expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
    });
};

const sendPasswordResetOTP = async (user, otp) => {
    await sendEmail({
        to: user.email,
        subject: "Password Reset OTP — Kicks Don't Stink",
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441;">KICKS DON'T STINK</h1>
        <h2 style="font-size: 24px; margin-bottom: 24px;">Password Reset Request</h2>
        <p style="color: #ccc; margin-bottom: 24px;">Your password reset OTP:</p>
        <div style="background: #6A1F2B; padding: 24px; text-align: center; border-radius: 8px; margin-bottom: 24px;">
          <span style="font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #F4F1EA;">${otp}</span>
        </div>
        <p style="color: #999; font-size: 14px;">This OTP expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
    });
};

const sendOrderConfirmation = async (user, order) => {
    const productsHtml = order.products
        .map(
            (p) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #333;">${p.name}${p.size ? ` (${p.size})` : ''}</td>
      <td style="padding: 12px; border-bottom: 1px solid #333; text-align: center;">${p.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #333; text-align: right;">₹${p.price.toFixed(2)}</td>
    </tr>
  `
        )
        .join('');

    await sendEmail({
        to: user.email,
        subject: `Order Confirmed #${order.orderNumber} — Kicks Don't Stink`,
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441;">KICKS DON'T STINK</h1>
        <h2 style="font-size: 22px; color: #2F3B2F; background: #D9A441; padding: 12px; margin-bottom: 24px;">✅ ORDER CONFIRMED!</h2>
        <p>Hey ${user.name}, your order <strong>#${order.orderNumber}</strong> is confirmed.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <thead><tr style="background: #2F3B2F;">
            <th style="padding: 12px; text-align: left;">Product</th>
            <th style="padding: 12px;">Qty</th>
            <th style="padding: 12px; text-align: right;">Price</th>
          </tr></thead>
          <tbody>${productsHtml}</tbody>
        </table>
        <div style="text-align: right; padding: 16px; background: #1a1a1a; border-radius: 8px;">
          <p>Subtotal: ₹${order.subtotal.toFixed(2)}</p>
          ${order.couponDiscount > 0 ? `<p style="color: #D9A441;">Coupon Discount: -₹${order.couponDiscount.toFixed(2)}</p>` : ''}
          <p>GST (${order.gst}%): ₹${order.gstAmount.toFixed(2)}</p>
          <p>Delivery: ₹${order.deliveryCharge.toFixed(2)}</p>
          <p style="font-size: 20px; font-weight: 900; color: #D9A441;">TOTAL: ₹${order.totalPrice.toFixed(2)}</p>
        </div>
        <p style="margin-top: 24px; color: #999; font-size: 14px;">Estimated delivery: 5-7 business days.</p>
      </div>
    `,
    });
};

const sendOrderShipped = async (user, order) => {
    await sendEmail({
        to: user.email,
        subject: `Order Shipped #${order.orderNumber} — Kicks Don't Stink`,
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441;">KICKS DON'T STINK</h1>
        <h2 style="color: #D9A441;">🚚 YOUR ORDER IS ON THE WAY!</h2>
        <p>Hi ${user.name}, your order <strong>#${order.orderNumber}</strong> has been shipped.</p>
        ${order.trackingInfo ? `<p>Tracking Info: <strong>${order.trackingInfo}</strong></p>` : ''}
        <p style="color: #999; font-size: 14px; margin-top: 24px;">Expected delivery in 2-3 business days.</p>
      </div>
    `,
    });
};

const sendOrderDelivered = async (user, order) => {
    await sendEmail({
        to: user.email,
        subject: `Order Delivered #${order.orderNumber} — Kicks Don't Stink`,
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441;">KICKS DON'T STINK</h1>
        <h2 style="color: #2F3B2F; background: #D9A441; padding: 12px;">📦 ORDER DELIVERED!</h2>
        <p>Hey ${user.name}, your order <strong>#${order.orderNumber}</strong> has been delivered. Hope you love your new kicks! 👟</p>
        <p style="margin-top: 16px;">We'd love to hear what you think — leave us a review!</p>
      </div>
    `,
    });
};

const sendOrderCancelled = async (user, order) => {
    await sendEmail({
        to: user.email,
        subject: `Order Cancelled #${order.orderNumber} — Kicks Don't Stink`,
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441;">KICKS DON'T STINK</h1>
        <h2 style="color: #6A1F2B; font-size: 22px;">❌ ORDER CANCELLED</h2>
        <p>Hi ${user.name}, your order <strong>#${order.orderNumber}</strong> has been cancelled.</p>
        ${order.cancelReason ? `<p>Reason: ${order.cancelReason}</p>` : ''}
        ${order.paymentStatus === 'paid' ? `<p style="color: #D9A441;">A refund of ₹${order.totalPrice.toFixed(2)} will be processed within 5-7 business days.</p>` : ''}
      </div>
    `,
    });
};

const sendPaymentFailed = async (user, order) => {
    await sendEmail({
        to: user.email,
        subject: `Payment Failed — Kicks Don't Stink`,
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441;">KICKS DON'T STINK</h1>
        <h2 style="color: #6A1F2B;">⚠️ PAYMENT FAILED</h2>
        <p>Hi ${user.name}, your payment for order <strong>#${order.orderNumber}</strong> failed.</p>
        <p>Please retry your payment from the order section in your profile.</p>
        <a href="${process.env.FRONTEND_URL}/profile" style="display: inline-block; background: #D9A441; color: #111; padding: 12px 24px; font-weight: 700; text-decoration: none; border-radius: 4px; margin-top: 16px;">RETRY PAYMENT</a>
      </div>
    `,
    });
};

const sendCouponApplied = async (user, couponCode, discount) => {
    await sendEmail({
        to: user.email,
        subject: `Coupon Applied — Kicks Don't Stink`,
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441;">KICKS DON'T STINK</h1>
        <h2>🎟️ Coupon Applied Successfully!</h2>
        <p>Hi ${user.name}! Your coupon <strong style="color: #D9A441;">${couponCode}</strong> has been applied for a <strong>${discount}% discount</strong>.</p>
      </div>
    `,
    });
};

const sendMonthlySalesReport = async (adminEmails, report) => {
    const topProductsHtml = report.topProducts
        .map((p, i) => `<tr><td style="padding:8px; border-bottom:1px solid #333;">${i + 1}. ${p.name}</td><td style="padding:8px; text-align:center; border-bottom:1px solid #333;">${p.sold}</td><td style="padding:8px; text-align:right; border-bottom:1px solid #333;">₹${p.revenue.toFixed(2)}</td></tr>`)
        .join('');

    const worstProductsHtml = report.worstProducts
        .map((p, i) => `<tr><td style="padding:8px; border-bottom:1px solid #333;">${i + 1}. ${p.name}</td><td style="padding:8px; text-align:center; border-bottom:1px solid #333;">${p.sold}</td><td style="padding:8px; text-align:right; border-bottom:1px solid #333;">₹${p.revenue.toFixed(2)}</td></tr>`)
        .join('');

    await sendEmail({
        to: adminEmails.join(', '),
        subject: `Monthly Sales Report — ${report.month} — Kicks Don't Stink`,
        html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #111; color: #F4F1EA; padding: 40px;">
        <h1 style="font-size: 32px; font-weight: 900; color: #D9A441;">KICKS DON'T STINK</h1>
        <h2>📊 Monthly Sales Report — ${report.month}</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0;">
          <div style="background: #2F3B2F; padding: 16px; border-radius: 8px; text-align: center;">
            <p style="font-size: 28px; font-weight: 900; color: #D9A441;">${report.totalOrders}</p>
            <p style="color: #ccc; font-size: 12px;">TOTAL ORDERS</p>
          </div>
          <div style="background: #2F3B2F; padding: 16px; border-radius: 8px; text-align: center;">
            <p style="font-size: 28px; font-weight: 900; color: #D9A441;">₹${report.totalRevenue.toFixed(2)}</p>
            <p style="color: #ccc; font-size: 12px;">REVENUE</p>
          </div>
          <div style="background: #2F3B2F; padding: 16px; border-radius: 8px; text-align: center;">
            <p style="font-size: 28px; font-weight: 900; color: #D9A441;">${report.newCustomers}</p>
            <p style="color: #ccc; font-size: 12px;">NEW CUSTOMERS</p>
          </div>
        </div>
        <div style="background: #1a1a1a; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <p>Average Order Value: <strong>₹${report.avgOrderValue.toFixed(2)}</strong></p>
          <p>Total Units Sold: <strong>${report.totalUnitsSold}</strong></p>
          <p>Pending Orders: <strong>${report.pendingOrders}</strong></p>
          <p>Cancelled Orders: <strong>${report.cancelledOrders}</strong></p>
        </div>
        <h3 style="color: #D9A441;">🏆 Top 5 Best-Selling Products</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
          <thead><tr style="background:#2F3B2F;"><th style="padding:8px; text-align:left;">Product</th><th>Units</th><th>Revenue</th></tr></thead>
          <tbody>${topProductsHtml}</tbody>
        </table>
        <h3 style="color: #6A1F2B;">📉 Top 5 Worst-Selling Products</h3>
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr style="background:#6A1F2B;"><th style="padding:8px; text-align:left;">Product</th><th>Units</th><th>Revenue</th></tr></thead>
          <tbody>${worstProductsHtml}</tbody>
        </table>
      </div>
    `,
    });
};

module.exports = {
    sendWelcomeOTP,
    sendPasswordResetOTP,
    sendOrderConfirmation,
    sendOrderShipped,
    sendOrderDelivered,
    sendOrderCancelled,
    sendPaymentFailed,
    sendCouponApplied,
    sendMonthlySalesReport,
};
