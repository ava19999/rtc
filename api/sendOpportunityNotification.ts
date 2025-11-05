// api/sendOpportunityNotification.ts
// Berfungsi untuk mengirim notifikasi broadcast ke semua pengguna
// tentang peluang koin baru.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Inisialisasi Firebase Admin (pastikan variabel env sudah di-set di Vercel)
const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

try {
  if (!admin.apps.length && serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL,
    });
    console.log('Firebase Admin SDK Initialized for Opportunity Notif.');
  } else if (!serviceAccountJson) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON env var is not set.');
  }
} catch (e: any) {
  console.error('Firebase Admin Initialization Error', e.message);
}

// Topik global untuk notifikasi peluang baru
const NOTIFICATION_TOPIC = 'peluang_baru'; // <-- Diganti sesuai permintaan

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Ambil data baru: messageBody, coinId, coinName, dan coinImage
    const { messageBody, coinId, coinName, coinImage } = req.body;

    // 1. Validasi input
    if (!messageBody || !coinName || !coinImage) {
      console.warn('Missing required fields:', req.body);
      return res.status(400).send('Missing required fields: messageBody, coinName, coinImage');
    }

    // 2. Buat payload notifikasi
    const message = {
      notification: {
        title: '🚀 Peluang Pasar Baru!',
        body: messageBody, // cth: "Peluang Baru Terdeteksi: Solana (SOL)!"
      },
      data: {
        screen: 'home', // Memberi tahu aplikasi (jika dibuka) untuk ke halaman utama
        coinId: coinId || '',
        coinName: coinName,
        coinImage: coinImage, // <-- Logo koin ditambahkan
        timestamp: Date.now().toString()
      },
      topic: NOTIFICATION_TOPIC // Kirim ke topik global
    };
    
    // 3. Kirim notifikasi
    console.log(`Sending opportunity notification to topic: ${NOTIFICATION_TOPIC}`);
    
    await admin.messaging().send(message);

    return res.status(200).send('Notification sent successfully.');

  } catch (error: any) {
    console.error('Error sending opportunity notification:', error.message);
    return res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};