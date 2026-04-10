const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { amount, currency, userId, plan } = JSON.parse(event.body);
        const options = {
            amount: amount,
            currency: currency,
            receipt: `receipt_${userId}_${Date.now()}`,
            notes: { userId, plan }
        };
        const order = await razorpay.orders.create(options);
        return {
            statusCode: 200,
            body: JSON.stringify({ orderId: order.id })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
