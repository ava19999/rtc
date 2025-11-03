// File: api/sendNotification.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// ==================== FIREBASE INITIALIZATION ====================
console.log('🔧 Initializing Firebase Admin SDK...');

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
  throw error;
}

// ==================== MAIN HANDLER ====================
export default async (req: VercelRequest, res: VercelResponse) => {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
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
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: roomId, sender, text'
      });
    }

    // 2. Jangan kirim notifikasi untuk room default
    const defaultRooms = ['berita-kripto', 'pengumuman-aturan'];
    if (defaultRooms.includes(roomId)) {
      return res.status(200).json({
        success: true,
        message: 'Default room, no notification sent.'
      });
    }

    // 3. Pastikan Firebase sudah terinisialisasi
    if (!isFirebaseInitialized || !admin.apps.length) {
      return res.status(500).json({
        error: 'Firebase Not Initialized',
        message: 'Firebase Admin SDK is not properly initialized'
      });
    }

    // 4. Ambil nama room dari database untuk judul notifikasi
    let roomName = roomId;
    try {
      const roomSnapshot = await admin.database().ref(`/rooms/${roomId}/name`).once('value');
      if (roomSnapshot.exists()) {
        roomName = roomSnapshot.val();
      }
    } catch (e: any) {
      console.warn(`Failed to fetch room name for ${roomId}:`, e.message);
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
        timestamp: Date.now().toString(),
        type: 'chat_message'
      },
      android: {
        priority: 'high'
      },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
        }
      },
      topic: roomId
    };
    
    // 7. Kirim menggunakan FCM
    const response = await admin.messaging().send(message);

    return res.status(200).json({
      success: true,
      message: 'Notification sent successfully.',
      messageId: response,
      topic: roomId
    });

  } catch (error: any) {
    console.error('Error sending notification:', error.message);

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

    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: error.code
    });
  }
};