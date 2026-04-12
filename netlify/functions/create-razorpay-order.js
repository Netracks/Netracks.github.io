const Razorpay = require('razorpay');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        console.log("ENV KEY:", process.env.RAZORPAY_KEY_ID);

        const { amount, currency, userId, plan } = JSON.parse(event.body);

        // ✅ Initialize inside handler
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const order = await razorpay.orders.create({
            amount: amount,
            currency: currency,
            receipt: `receipt_${userId}_${Date.now()}`,
            notes: { userId, plan }
        });

        console.log("ORDER CREATED:", order.id);

        return {
            statusCode: 200,
            body: JSON.stringify({ orderId: order.id })
        };

    } catch (error) {
        console.error("ERROR:", error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
