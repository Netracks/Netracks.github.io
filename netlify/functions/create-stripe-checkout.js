const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { amount, plan, userId, email } = JSON.parse(event.body);
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: `LinkTracker ${plan.toUpperCase()} Plan`,
                        description: plan === 'basic' ? 'Up to 20 links, basic analytics' : 'Unlimited links, full analytics'
                    },
                    unit_amount: amount * 100, // Stripe uses paise (₹100 = 10000 paise)
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.URL}/index.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.URL}/premium.html`,
            client_reference_id: userId,
            customer_email: email,
            metadata: { userId, plan }
        });
        return {
            statusCode: 200,
            body: JSON.stringify({ sessionId: session.id })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
