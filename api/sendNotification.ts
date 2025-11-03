// File: api/sendNotification.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// ==================== FIREBASE INITIALIZATION ====================
console.log('🔧 Initializing Firebase Admin SDK...');
console.log('🔧 Environment check:', {
  hasServiceAccount: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  hasDatabaseUrl: !!process.env.FIREBASE_DATABASE_URL,
  hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
  serviceAccountLength: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length,
  nodeEnv: process.env.NODE_ENV,
  vercelEnv: process.env.VERCEL_ENV
});

let isFirebaseInitialized = false;

try {
  // Assert that environment variables are available
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is required');
  }

  if (!process.env.FIREBASE_DATABASE_URL) {
    throw new Error('FIREBASE_DATABASE_URL environment variable is required');
  }

  const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  
  // Validate service account structure
  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Invalid service account structure');
  }

  console.log('✅ Service account validated, project:', serviceAccount.project_id);

  // Initialize Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.log('✅ Firebase Admin SDK already initialized');
  }
  
  isFirebaseInitialized = true;

} catch (error: any) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  console.error('❌ Error details:', {
    message: error.message,
    code: error.code,
    hasServiceAccount: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    serviceAccountPreview: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.substring(0, 100) + '...'
  });
  throw error; // Re-throw to prevent the function from starting
}

// ==================== MAIN HANDLER ====================
export default async (req: VercelRequest, res: VercelResponse) => {
  // Log request untuk debugging
  console.log('📨 Received notification request:', {
    method: req.method,
    path: req.url,
    body: req.body
  });

  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    console.warn('⚠️ Method Not Allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported'
    });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { roomId, sender, text } = req.body;

    // 1. Validasi input
    if (!roomId || !sender || !text) {
      console.warn('❌ Missing required fields:', { roomId, sender, text });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: roomId, sender, text',
        received: { roomId, sender, text }
      });
    }

    // 2. Jangan kirim notifikasi untuk room default
    const defaultRooms = ['berita-kripto', 'pengumuman-aturan'];
    if (defaultRooms.includes(roomId)) {
      console.log('ℹ️ Default room, no notification sent:', roomId);
      return res.status(200).json({
        success: true,
        message: 'Default room, no notification sent.'
      });
    }

    // 3. Pastikan Firebase sudah terinisialisasi
    if (!isFirebaseInitialized || !admin.apps.length) {
      console.error('❌ Firebase not initialized - cannot send notification');
      return res.status(500).json({
        error: 'Firebase Not Initialized',
        message: 'Firebase Admin SDK is not properly initialized',
        debug: {
          isFirebaseInitialized,
          firebaseAppsCount: admin.apps.length,
          hasServiceAccount: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
          hasDatabaseUrl: !!process.env.FIREBASE_DATABASE_URL
        }
      });
    }

    // 4. Ambil nama room dari database untuk judul notifikasi
    let roomName = roomId;
    try {
      console.log(`🔍 Fetching room name for: ${roomId}`);
      const roomSnapshot = await admin.database().ref(`/rooms/${roomId}/name`).once('value');
      if (roomSnapshot.exists()) {
        roomName = roomSnapshot.val();
        console.log(`✅ Room name found: ${roomName}`);
      } else {
        console.warn(`⚠️ Room name not found for ${roomId}, using ID as fallback`);
      }
    } catch (e: any) {
      console.warn(`⚠️ Failed to fetch room name for ${roomId}:`, e.message);
      // Continue with roomId as fallback
    }
    
    // 5. Potong pesan jika terlalu panjang
    const truncatedBody = text.length > 100 ? text.substring(0, 97) + '...' : text;

    // 6. Buat payload notifikasi FCM
    const message = {
      notification: {
        title: `Pesan baru di #${roomName}`,
        body: `${sender}: ${truncatedBody}`,
      },
      data: {
        roomId: roomId,
        sender: sender,
        originalText: text,
        timestamp: Date.now().toString(),
        type: 'chat_message'
      },
      android: {
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      },
      topic: roomId
    };

    console.log(`🚀 Sending FCM notification to topic: ${roomId}`, {
      title: message.notification.title,
      body: message.notification.body,
      data: message.data
    });
    
    // 7. Kirim menggunakan FCM
    const response = await admin.messaging().send(message);
    console.log('✅ FCM Notification sent successfully:', {
      messageId: response,
      topic: roomId,
      roomName: roomName
    });

    return res.status(200).json({
      success: true,
      message: 'Notification sent successfully.',
      messageId: response,
      topic: roomId,
      roomName: roomName,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('💥 Error sending notification:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      body: req.body
    });

    // Handle specific FCM errors
    if (error.code === 'messaging/invalid-recipient') {
      return res.status(400).json({
        error: 'Invalid recipient',
        message: 'The notification recipient is invalid'
      });
    }
    
    if (error.code === 'messaging/registration-token-not-registered') {
      return res.status(404).json({
        error: 'Token not registered',
        message: 'The device token is no longer registered'
      });
    }

    if (error.code === 'messaging/invalid-argument') {
      return res.status(400).json({
        error: 'Invalid argument',
        message: error.message
      });
    }

    if (error.code === 'messaging/unknown-error') {
      return res.status(500).json({
        error: 'FCM Unknown Error',
        message: 'An unknown error occurred while sending the notification'
      });
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: error.code
    });
  }
};