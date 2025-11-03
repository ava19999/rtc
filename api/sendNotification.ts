// File: api/sendNotification.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

// Inisialisasi Firebase Admin HANYA SEKALI
try {
  if (!admin.apps.length && serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL,
    });
    console.log('Firebase Admin SDK Initialized.');
  } else if (!serviceAccountJson) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON env var is not set.');
  }
} catch (e: any) {
  console.error('Firebase Admin Initialization Error', e.message);
}

// Tambahkan daftar room default di sisi server (untuk keamanan)
const DEFAULT_ROOM_IDS = ['berita-kripto', 'pengumuman-aturan'];

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { roomId, sender, text } = req.body;

    // 1. Validasi input
    if (!roomId || !sender || !text) {
      console.warn('Missing required fields:', req.body);
      return res.status(400).send('Missing required fields: roomId, sender, text');
    }

    // 2. Jangan kirim notifikasi untuk room default
    if (DEFAULT_ROOM_IDS.includes(roomId)) {
      console.log('Default room, no notification sent.');
      return res.status(200).send('Default room, no notification sent.');
    }
    
    // 3. Ambil nama room dari database untuk judul notifikasi
    let roomName = roomId;
    try {
      const roomSnapshot = await admin.database().ref(`/rooms/${roomId}/name`).once('value');
      if (roomSnapshot.exists()) {
        roomName = roomSnapshot.val();
      }
    } catch(e) {
      console.warn(`Failed to fetch room name for ${roomId}:`, (e as Error).message);
    }
    
    // 4. Potong pesan jika terlalu panjang
    const body = text.length > 100 ? text.substring(0, 97) + '...' : text;

    // 5. Buat payload notifikasi dengan topic
    const message = {
      notification: {
        title: `Pesan baru di #${roomName}`,
        body: `${sender}: ${body}`,
      },
      data: {
        roomId: roomId,
      },
      topic: roomId // Menambahkan topic di sini
    };
    
    // 6. Kirim menggunakan metode send yang benar
    console.log(`Sending notification to topic: ${roomId}`);
    
    await admin.messaging().send(message);

    return res.status(200).send('Notification sent successfully.');

  } catch (error: any) {
    console.error('Error sending notification:', error.message);
    return res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};