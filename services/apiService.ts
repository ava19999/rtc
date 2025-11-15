// services/apiService.ts

// Layanan cache dalam memori sederhana telah diganti dengan localStorage untuk persistensi.

export const CACHE_DURATION = {
  SHORT: 30 * 1000, // 30 detik
  DEFAULT: 2 * 60 * 1000, // 2 menit
  NEWS: 20 * 60 * 1000, // 20 menit
  LONG: 60 * 60 * 1000, // 1 jam
};

// --- PERBAIKAN DI SINI ---
const MAX_RETRIES = 5; // Naikkan dari 3 ke 5
const INITIAL_BACKOFF = 1000; // 1 detik
const TIMEOUT_DURATION = 20000; // Naikkan dari 15 detik ke 20 detik
// --- AKHIR PERBAIKAN ---

// Helper untuk memeriksa ketersediaan localStorage dengan aman.
const isLocalStorageAvailable = () => {
  try {
    const testKey = '__test_local_storage__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

const storageAvailable = isLocalStorageAvailable();

/**
 * Membersihkan item cache yang sudah kedaluwarsa dari localStorage.
 * Ini membantu mengelola ruang penyimpanan.
 */
const clearExpiredCache = () => {
  if (!storageAvailable) return;

  const now = Date.now();
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('api_cache_')) {
      try {
        const itemString = localStorage.getItem(key);
        if (itemString) {
          const cachedItem = JSON.parse(itemString);
          if (now >= cachedItem.expiry) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        // Hapus item yang rusak jika parsing gagal
        localStorage.removeItem(key);
      }
    }
  });
};


/**
 * Fungsi pembantu untuk menangani permintaan API dengan caching, penanganan kesalahan, percobaan ulang, dan timeout.
 * Cache ditingkatkan untuk menggunakan localStorage untuk persistensi data di seluruh sesi.
 * @param url URL untuk diambil.
 * @param cacheDuration Durasi dalam milidetik untuk menyimpan cache respons.
 * @returns Respons JSON.
 */
export const apiRequest = async (url: string, cacheDuration: number = CACHE_DURATION.DEFAULT) => {
  const now = Date.now();
  const cacheKey = `api_cache_${url}`;

  // Coba ambil dari cache localStorage jika tersedia
  if (storageAvailable) {
    try {
      const cachedItemString = localStorage.getItem(cacheKey);
      if (cachedItemString) {
        const cachedItem = JSON.parse(cachedItemString);
        if (now < cachedItem.expiry) {
          return cachedItem.data;
        } else {
          localStorage.removeItem(cacheKey); // Hapus item yang sudah kedaluwarsa
        }
      }
    } catch (error) {
      console.warn("Gagal membaca dari localStorage:", error);
    }
  }

  const fetchDataWithRetries = async (retries: number): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_DURATION);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      // Coba lagi pada kesalahan server tertentu (mis., pembatasan tarif, masalah server sementara)
      if (!response.ok && [429, 500, 502, 503, 504].includes(response.status) && retries > 0) {
        throw new Error(`Kesalahan server yang dapat dicoba lagi: ${response.status}`);
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (retries > 0) {
        // --- PERBAIKAN DI SINI: Tambahkan Jitter (jeda acak) ---
        // Penundaan eksponensial + jeda acak (jitter) hingga 1 detik
        const jitter = Math.random() * 1000;
        const backoff = INITIAL_BACKOFF * Math.pow(2, MAX_RETRIES - retries) + jitter;
        // --- AKHIR PERBAIKAN ---
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchDataWithRetries(retries - 1);
      }
      // Jika ini adalah AbortError dari timeout kita, lemparkan pesan yang lebih spesifik
      if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('Permintaan memakan waktu terlalu lama dan telah dibatalkan.');
      }
      throw error; // Lemparkan kembali kesalahan terakhir jika percobaan ulang habis
    }
  };

  try {
    const response = await fetchDataWithRetries(MAX_RETRIES);

    if (!response.ok) {
      // Fix: Explicitly type errorData as 'any' to allow accessing properties that may exist on the error object returned by the API.
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {
        // Abaikan jika respons bukan JSON
      }
      const errorMessage = errorData?.error || `Permintaan gagal dengan status ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Simpan ke cache localStorage jika tersedia
    if (storageAvailable) {
      try {
        const itemToCache = { data, expiry: now + cacheDuration };
        localStorage.setItem(cacheKey, JSON.stringify(itemToCache));
      } catch (error) {
        console.warn("Gagal menulis ke localStorage:", error);
        // Jika penyimpanan penuh, bersihkan cache yang sudah kedaluwarsa dan coba lagi sekali
        if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          clearExpiredCache();
          try {
             const itemToCache = { data, expiry: now + cacheDuration };
             localStorage.setItem(cacheKey, JSON.stringify(itemToCache));
          } catch(e) {
            console.warn("Gagal menulis ke localStorage bahkan setelah dibersihkan:", e);
          }
        }
      }
    }

    return data;

  } catch (error) {
    console.error(`Permintaan API gagal untuk ${url}:`, error);
    // Propagasi pesan kesalahan yang ramah pengguna
    if (error instanceof Error) {
        throw new Error(error.message);
    }
    throw new Error('Terjadi kesalahan jaringan yang tidak diketahui.');
  }
};