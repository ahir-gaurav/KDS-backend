const crypto = require('crypto');

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateOrderNumber = (count) => {
    return `KDS${String(count + 1).padStart(6, '0')}`;
};

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');
    return expectedSignature === signature;
};

module.exports = { generateOTP, generateOrderNumber, verifyRazorpaySignature };
