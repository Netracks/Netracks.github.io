const crypto = require('crypto');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (use environment variables for service account)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
}
const db = admin.database();

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { orderId, paymentId, signature, userId, plan } = JSON.parse(event.body);
        const secret = process.env.RAZORPAY_KEY_SECRET;
        const generatedSignature = crypto.createHmac('sha256', secret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
        
        if (generatedSignature !== signature) {
            return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid signature' }) };
        }

        // Update user subscription in Firebase
        const subscriptionRef = db.ref(`users/${userId}/subscription`);
        await subscriptionRef.set({
            plan: plan,
            active: true,
            purchasedAt: Date.now(),
            amount: plan === 'basic' ? 100 : 150,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            razorpayPaymentId: paymentId
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
