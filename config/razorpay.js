const Razorpay = require('razorpay');

let razorpay;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
} else {
    console.warn('⚠️  RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing. Payment features will not work.');
    // Export a dummy object or null
    razorpay = {
        orders: {
            create: async () => { throw new Error('Razorpay keys missing from environment'); }
        },
        payments: {
            fetch: async () => { throw new Error('Razorpay keys missing from environment'); }
        }
    };
}

module.exports = razorpay;
