const admin = require('firebase-admin');

// تهيئة الاتصال بـ Firebase بصلاحية الأدمن السحابية
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin init error:', error);
  }
}

module.exports = async (req, res) => {
  // السماح باستقبال الطلبات من تطبيق فلاتر
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipientId, title, body, orderId, type } = req.body;

    if (!recipientId || !title || !body) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // 1. قراءة التوكن الخاص بالمستلم مباشرة وبدون الحاجة لخرق الـ Rules
    const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      return res.status(404).json({ error: 'User has no registered FCM token' });
    }

    // 2. إرسال الإشعار الخارجي الرسمي عبر خوادم Google FCM
    const message = {
      token: fcmToken,
      notification: {
        title: title,
        body: body
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: type || 'general',
        orderId: orderId || ''
      }
    };

    const response = await admin.messaging().send(message);
    return res.status(200).json({ success: true, messageId: response });

  } catch (error) {
    console.error('Push notification sending failed:', error);
    return res.status(500).json({ error: error.message });
  }
};
