import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// --- KONSTANTA DISALIN LANGSUNG ---
const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';

// --- Inisialisasi Firebase Admin ---
const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const databaseURL = process.env.FIREBASE_DATABASE_URL;

try {
  if (!admin.apps.length && serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL,
    });
    console.log('[checkTrendingCoins] Firebase Admin SDK Initialized.');
  } else if (!serviceAccountJson) {
    console.error('[checkTrendingCoins] GOOGLE_APPLICATION_CREDENTIALS_JSON env var is not set.');
  }
} catch (e: any) {
  console.error('[checkTrendingCoins] Firebase Admin Initialization Error', e.message);
}
// --- Akhir Inisialisasi ---

const DB_PATH = 'system_state/trending_coins_lastKnown';
const TRENDING_ROOM_ID = 'peluang-baru'; 

interface TrendingCoin {
  id: string;
  name: string;
}

async function fetchTrendingCoinsServerSide(): Promise<TrendingCoin[]> {
  const trendingUrl = `${COINGECKO_API_BASE_URL}/search/trending`;
  const response = await fetch(trendingUrl); 
  if (!response.ok) {
    throw new Error(`[checkTrendingCoins] Gagal mengambil data trending: ${response.statusText}`);
  }
  const trendingData = await response.json();
  
  // Ubah .slice(0, 11) menjadi .slice(0, 16)
  const trendingCoins: TrendingCoin[] = trendingData.coins
    .map((c: any) => ({
      id: c.item.id,
      name: c.item.name
    }))
    .slice(0, 16);
    
  return trendingCoins;
}

// --- PERUBAHAN DIMULAI DI FUNGSI INI ---
async function postMessageToRoom(db: admin.database.Database, coinNames: string) {
  // Tentukan batas riwayat chat
  const HISTORY_LIMIT = 10;

  try {
    const messageListRef = db.ref(`messages/${TRENDING_ROOM_ID}`);
    
    // 1. Post pesan baru
    const newMessageRef = messageListRef.push(); 
    const systemMessage = {
      type: 'system',
      text: `📈 Peluang Pasar Baru Terdeteksi: ${coinNames}`,
      timestamp: admin.database.ServerValue.TIMESTAMP
    };
    await newMessageRef.set(systemMessage);
    console.log(`[checkTrendingCoins] Berhasil mem-posting pesan sistem ke room ${TRENDING_ROOM_ID}`);

    // 2. Logika untuk memangkas (trim) riwayat chat
    // Ambil snapshot dari semua pesan di room ini, diurutkan berdasarkan kunci (otomatis kronologis)
    const snapshot = await messageListRef.orderByKey().once('value');
    const currentCount = snapshot.numChildren();
    
    // Jika jumlah pesan melebihi batas
    if (currentCount > HISTORY_LIMIT) {
      const messagesToDelete = currentCount - HISTORY_LIMIT;
      const updates: { [key: string]: null } = {};
      let i = 0;
      
      // Loop melalui snapshot (yang sudah terurut dari terlama ke terbaru)
      snapshot.forEach(child => {
        // Tandai pesan-pesan terlama untuk dihapus
        if (i < messagesToDelete) {
          updates[child.key!] = null; // Menyetel nilai ke null akan menghapusnya
          i++;
        }
      });

      // Hapus semua pesan lama dalam satu operasi update
      await messageListRef.update(updates);
      console.log(`[checkTrendingCoins] Memangkas riwayat: ${messagesToDelete} pesan lama dihapus.`);
    }

  } catch (e) {
    console.error(`[checkTrendingCoins] Gagal mem-posting atau memangkas pesan ke room:`, (e as Error).message);
  }
}
// --- AKHIR PERUBAHAN ---

export default async (req: VercelRequest, res: VercelResponse) => {
  // Kita ubah dari POST ke GET, agar Uptime Robot bisa memanggilnya
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed (Only GET accepted)');
  }

  if (!admin.apps.length) {
    console.error('[checkTrendingCoins] Firebase Admin not initialized. Aborting.');
    return res.status(500).send('Firebase Admin not initialized');
  }

  try {
    console.log('[checkTrendingCoins] Cron job (Uptime Robot) started...');
    
    const newTrendingCoins = await fetchTrendingCoinsServerSide();
    if (newTrendingCoins.length === 0) {
      console.warn('[checkTrendingCoins] Mengambil 0 koin trending. Batal.');
      return res.status(200).json({ success: true, message: 'Mengambil 0 koin, tidak ada aksi.' });
    }

    const db = admin.database();
    const oldDataSnapshot = await db.ref(DB_PATH).once('value');
    const oldTrendingIds: string[] = oldDataSnapshot.val() || [];

    const newTrendingIds = newTrendingCoins.map(c => c.id);
    console.log(`[checkTrendingCoins] ID Lama (${oldTrendingIds.length}):`, oldTrendingIds.join(', ') || 'Kosong');
    console.log(`[checkTrendingCoins] ID Baru (${newTrendingIds.length}):`, newTrendingIds.join(', '));

    const oldIdsSet = new Set(oldTrendingIds);
    const newlyAddedCoins = newTrendingCoins.filter(coin => !oldIdsSet.has(coin.id));

    let notificationSent = false;
    let message = 'Tidak ada koin baru ditemukan.';

    if (newlyAddedCoins.length > 0 && oldTrendingIds.length > 0) {
      const coinNames = newlyAddedCoins.map(c => c.name).join(', ');
      console.log(`[checkTrendingCoins] Koin baru ditemukan:`, coinNames);

      const body = coinNames.length > 100 
        ? `Beberapa koin baru terdeteksi di Peluang Pasar...` 
        : `Koin baru di Peluang Pasar: ${coinNames}`;

      const fcmMessage = {
        notification: {
          title: '📈 Peluang Pasar Baru!',
          body: body,
        },
        data: {
          roomId: TRENDING_ROOM_ID, 
          roomName: "Peluang Baru",
          messageText: body,
          sender: "RT Crypto AI"
        },
        topic: TRENDING_ROOM_ID
      };
      
      await admin.messaging().send(fcmMessage);
      await postMessageToRoom(db, coinNames); // <- Fungsi ini sekarang juga akan memangkas riwayat
      
      notificationSent = true;
      message = `Koin baru ditemukan: ${coinNames}. Notifikasi & pesan room terkirim.`;

    } else if (newlyAddedCoins.length > 0 && oldTrendingIds.length === 0) {
      console.log('[checkTrendingCoins] Run pertama, menyimpan daftar tanpa notifikasi.');
      message = 'Run pertama, menyimpan daftar tanpa notifikasi.';
    }

    if (newlyAddedCoins.length > 0) {
      await db.ref(DB_PATH).set(newTrendingIds); 
      console.log('[checkTrendingCoins] Memperbarui RTDB dengan daftar koin baru.');
      message += ' DB diperbarui.';
    }

    res.status(200).json({ 
      success: true, 
      message: message,
      notification_sent: notificationSent,
      new_coins: newlyAddedCoins.map(c => c.name)
    });

  } catch (error: any) {
    console.error('[checkTrendingCoins] Error:', error.message);
    res.status(500).send(`Internal Server Error: ${error.message}`);
  }
};