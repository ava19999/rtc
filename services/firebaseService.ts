// services/firebaseService.ts
import { initializeApp, FirebaseApp, FirebaseOptions } from "firebase/app";
import { getDatabase, Database, ref, onValue } from "firebase/database";

// Konfigurasi Firebase
const getFirebaseConfig = (): FirebaseOptions => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
  };

  // Debug logging untuk membantu troubleshooting
  console.log('Firebase Config Check:', {
    hasApiKey: !!config.apiKey,
    hasDatabaseURL: !!config.databaseURL,
    hasProjectId: !!config.projectId,
    databaseURL: config.databaseURL ? '***' + config.databaseURL.slice(-20) : 'missing'
  });

  return config;
};

let app: FirebaseApp | null = null;
let database: Database | null = null;

export const getFirebaseApp = (): FirebaseApp | null => {
  if (app) return app;
  
  try {
    const firebaseConfig = getFirebaseConfig();

    // Validasi konfigurasi yang lebih ketat
    const requiredConfigs = [
      { key: 'apiKey', value: firebaseConfig.apiKey },
      { key: 'databaseURL', value: firebaseConfig.databaseURL },
      { key: 'projectId', value: firebaseConfig.projectId },
    ];

    const missingConfigs = requiredConfigs.filter(config => !config.value);
    
    if (missingConfigs.length > 0) {
      const missingKeys = missingConfigs.map(config => config.key).join(', ');
      console.error('❌ Konfigurasi Firebase tidak lengkap. Missing:', missingKeys);
      throw new Error(`Konfigurasi Firebase tidak lengkap! Missing: ${missingKeys}`);
    }

    // Inisialisasi Firebase
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase initialized successfully.");
    
    return app;
  } catch (error) {
    console.error("❌ Gagal menginisialisasi Firebase:", error);
    return null;
  }
};

export const getDatabaseInstance = (): Database | null => {
  if (database) return database;
  
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    console.error('❌ Tidak dapat mendapatkan Firebase App');
    return null;
  }
  
  try {
    database = getDatabase(firebaseApp);
    console.log("✅ Database instance created successfully");
    return database;
  } catch (error) {
    console.error("❌ Gagal mendapatkan instance database:", error);
    return null;
  }
};

// Test koneksi database
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const db = getDatabaseInstance();
    if (!db) {
      console.error('❌ Database instance tidak tersedia');
      return false;
    }
    
    // Coba baca dari path test
    const testRef = ref(db, '.info/connected');
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Database connection test timeout');
        resolve(false);
      }, 5000);

      onValue(testRef, (snapshot) => {
        clearTimeout(timeout);
        const connected = snapshot.val();
        console.log('📡 Database connection test:', connected ? '✅ Connected' : '❌ Disconnected');
        resolve(!!connected);
      }, { onlyOnce: true });
    });
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

// Fungsi untuk mengecek status koneksi real-time
export const monitorConnection = (callback: (connected: boolean) => void): (() => void) => {
  try {
    const db = getDatabaseInstance();
    if (!db) {
      console.error('❌ Tidak dapat memonitor koneksi: database tidak tersedia');
      return () => {};
    }

    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val();
      console.log('📡 Connection status:', connected ? '✅ Connected' : '❌ Disconnected');
      callback(!!connected);
    });

    return unsubscribe;
  } catch (error) {
    console.error('❌ Gagal memonitor koneksi:', error);
    return () => {};
  }
};

// Inisialisasi otomatis saat module dimuat
console.log('🚀 Initializing Firebase...');
try {
  getFirebaseApp();
  getDatabaseInstance();
  
  // Test koneksi secara asynchronous
  setTimeout(() => {
    testDatabaseConnection().then(connected => {
      if (connected) {
        console.log('🎉 Firebase berhasil diinisialisasi dan terhubung!');
      } else {
        console.warn('⚠️ Firebase diinisialisasi tetapi koneksi bermasalah');
      }
    });
  }, 1000);
  
} catch (error) {
  console.error("❌ Automatic initialization failed:", error);
}

// Ekspor instance untuk backward compatibility
export { app, database };

export default {
  app,
  database,
  getFirebaseApp,
  getDatabaseInstance,
  testDatabaseConnection,
  monitorConnection
};