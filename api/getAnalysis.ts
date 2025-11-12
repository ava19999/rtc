// api/getAnalysis.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'; 
import { GoogleGenAI, Type } from "@google/genai";
import admin from 'firebase-admin';
// Impor tipe baru dari file types
import type { AnalysisResult, TradePlan } from '../types'; 

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
    console.log('[getAnalysis] Firebase Admin SDK Initialized.');
  } else if (!serviceAccountJson) {
    console.error('[getAnalysis] GOOGLE_APPLICATION_CREDENTIALS_JSON env var is not set.');
  }
} catch (e: any) {
  console.error('[getAnalysis] Firebase Admin Initialization Error', e.message);
}
// --- Akhir Inisialisasi ---


// 1. AMBIL API KEY DARI VERCEL ENVIRONMENT VARIABLES (AMAN)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// 2. Skema untuk satu rencana trading (TradePlan)
const tradePlanSchema = {
  type: Type.OBJECT,
  properties: {
    position: { 
      type: Type.STRING, 
      description: 'The recommended trading position, either "Long" or "Short".' 
    },
    entryPrice: { 
      type: Type.STRING, 
      description: 'The recommended entry price. Return ONLY the number or range (e.g., "68000-68100" or "67000"), WITHOUT any currency symbols like $.'
    },
    stopLoss: { 
      type: Type.STRING, 
      description: 'The recommended stop-loss price. Return ONLY the number (e.g., "67000"), WITHOUT any currency symbols like $.'
    },
    takeProfit: { 
      type: Type.STRING, 
      description: 'The recommended take-profit target. Return ONLY the number (e.g., "72000"), WITHOUT any currency symbols like $.'
    },
    confidence: { 
      type: Type.STRING, 
      description: 'The confidence level (e.g., "High", "Medium", "Low").'
    },
  },
  required: ['position', 'entryPrice', 'stopLoss', 'takeProfit', 'confidence'],
};

// --- PERUBAHAN DI SINI ---
// 3. Skema untuk meminta KEDUA rencana (Cache Tidak Valid)
const fullAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    bestOption: {
      ...tradePlanSchema,
      description: "The high-probability, high R:R, 'best price' limit order plan. This is the plan to be cached."
    },
    currentPricePlan: {
      ...tradePlanSchema,
      description: "The trade plan for entering at the current market price, based on the 5-Min ORB strategy. Omit this field (set to null) if the strategy says to WAIT."
    },
    reasoning: {
      type: Type.STRING,
      description: "A brief, clear rationale in Indonesian *only* for the 'currentPricePlan'. Explain why the 3-step checklist passed or FAILED."
    },
  },
  required: ['bestOption', 'reasoning'], // 'currentPricePlan' dibuat opsional
};

// 4. Skema untuk meminta HANYA rencana harga saat ini (Cache Valid)
const currentPriceOnlySchema = {
    type: Type.OBJECT,
    properties: {
      currentPricePlan: {
        ...tradePlanSchema,
        description: "The trade plan for entering at the current market price, based on the 5-Min ORB strategy. Omit this field (set to null) if the strategy says to WAIT."
      },
      reasoning: {
        type: Type.STRING,
        description: "A brief, clear rationale in Indonesian *only* for the 'currentPricePlan'. Explain why the 3-step checklist passed or FAILED."
      },
    },
    required: ['reasoning'], // 'currentPricePlan' dibuat opsional
};
// --- AKHIR PERUBAHAN ---


// Fungsi helper untuk memanggil AI
async function callGemini(prompt: string, schema: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
      temperature: 0.5, // Sedikit kreativitas untuk analisis
    },
  });

  const jsonString = (response.text ?? '').trim();
  if (!jsonString) {
    throw new Error("Respons AI kosong.");
  }
  return JSON.parse(jsonString);
}


// 5. Buat handler untuk Vercel
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // 6. Ambil data dari body, tambahkan cryptoId
    const { cryptoName, currentPrice, cryptoId } = req.body;

    if (!cryptoName || currentPrice === undefined || !cryptoId) {
      return res.status(400).json({ error: 'cryptoName, currentPrice, dan cryptoId diperlukan' });
    }
    
    if (!process.env.API_KEY) {
      throw new Error("Kunci API Gemini tidak dikonfigurasi di Vercel.");
    }
    
    if (!admin.apps.length) {
        throw new Error("Firebase Admin SDK tidak terinisialisasi.");
    }

    const formattedPrice = currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(4);
    const db = admin.database();
    const cachePath = `analysis_cache/${cryptoId}`;
    const cacheRef = db.ref(cachePath);
    let isCacheValid = false;
    let cachedBestOption: TradePlan | null = null;

    // --- LOGIKA CACHE ---
    try {
        const snapshot = await cacheRef.once('value');
        const cachedData: TradePlan | null = snapshot.val();

        if (cachedData) {
            console.log(`[getAnalysis] Cache ditemukan untuk ${cryptoId}. Memvalidasi...`);
            const currentPriceNum = parseFloat(currentPrice);
            const sl = parseFloat(cachedData.stopLoss.replace(/[^0-9.-]+/g,""));
            const tp = parseFloat(cachedData.takeProfit.replace(/[^0-9.-]+/g,""));

            if (isNaN(sl) || isNaN(tp)) {
                 console.warn(`[getAnalysis] Cache ${cryptoId} SL/TP tidak valid.`);
                 isCacheValid = false;
            } else if (cachedData.position === 'Long' && (currentPriceNum <= sl || currentPriceNum >= tp)) {
                 console.log(`[getAnalysis] Cache ${cryptoId} (Long) TIDAK VALID. Harga: ${currentPriceNum}, SL: ${sl}, TP: ${tp}`);
                 isCacheValid = false;
            } else if (cachedData.position === 'Short' && (currentPriceNum >= sl || currentPriceNum <= tp)) {
                 console.log(`[getAnalysis] Cache ${cryptoId} (Short) TIDAK VALID. Harga: ${currentPriceNum}, SL: ${sl}, TP: ${tp}`);
                 isCacheValid = false;
            } else {
                 console.log(`[getAnalysis] Cache ${cryptoId} VALID.`);
                 isCacheValid = true;
                 cachedBestOption = cachedData;
            }
        } else {
            console.log(`[getAnalysis] Tidak ada cache untuk ${cryptoId}.`);
            isCacheValid = false;
        }
    } catch (e) {
         console.error(`[getAnalysis] Error membaca cache Firebase:`, (e as Error).message);
         isCacheValid = false;
    }
    // --- AKHIR LOGIKA CACHE ---


    if (isCacheValid && cachedBestOption) {
      // --- KASUS 1: CACHE VALID ---
      // Minta HANYA 'currentPricePlan' dan 'reasoning'-nya
      
      // --- PERUBAHAN PROMPT ---
      const promptCurrentOnly = `
        Persona: 'RTC Pro Trader AI'. Anda adalah scalper 5 menit yang SANGAT DISIPLIN.
        
        STRATEGI WAJIB ANDA: "DataTrader 5-Min Opening Range Breakout (ORB)".
        Harga ${cryptoName} saat ini: **$${formattedPrice}**.

        TUGAS:
        Jalankan 3-LANGKAH CEKLIS berikut untuk harga saat ini ($${formattedPrice}).

        1.  **CEKLIS 1: Identifikasi Range 5 Menit.**
            * Apakah sudah terbentuk 'Opening Range' 5 menit yang jelas (misal, 1-2 jam terakhir)?
            * Tentukan Support (Low) dan Resistance (High) dari range tersebut.

        2.  **CEKLIS 2: Konfirmasi Breakout/Breakdown.**
            * Apakah harga saat ini ($${formattedPrice}) sudah *tutup* (close) di luar range itu?
            * Jika ya, apakah ini breakout (di atas High) atau breakdown (di bawah Low)?

        3.  **CEKLIS 3: Entry (Kriteria Saat Ini).**
            * Apakah harga saat ini berada di titik entry yang ideal (misal: sedang melakukan retest ke range, atau baru saja breakout)?

        OUTPUT:
        1.  **Jika SEMUA 3 ceklis lolos (misal: Range ada, Breakout terkonfirmasi, dan harga saat ini ideal untuk entry):**
            * Buat \`currentPricePlan\` (Long/Short) dengan SL ketat (misal: di dalam range) dan TP 1.5R.
            * Set \`confidence\` ke "Medium" atau "High".
            * Di \`reasoning\`: Jelaskan bahwa 3 ceklis lolos.

        2.  **Jika SATU SAJA ceklis GAGAL (misal: harga masih di dalam range, atau sudah breakout tapi terlalu jauh):**
            * Set \`currentPricePlan\` ke \`null\` (atau jangan sertakan field-nya).
            * Di \`reasoning\`: Beri tahu statusnya. Contoh: "REKOMENDASI: TUNGGU. Gagal Ceklis 2: Harga masih di dalam range 5 menit. Belum ada konfirmasi breakout."
      `;
      // --- AKHIR PROMPT ---
      
      console.log(`[getAnalysis] Cache VALID. Meminta AI (Mode DataTrader 5-Min ORB) HANYA untuk rencana harga saat ini...`);
      const freshData = await callGemini(promptCurrentOnly, currentPriceOnlySchema);

      const finalResult: AnalysisResult = {
        bestOption: cachedBestOption,
        // --- PERUBAHAN DI SINI ---
        currentPricePlan: freshData.currentPricePlan || null, // Pastikan null jika tidak ada
        // --- AKHIR PERUBAHAN ---
        reasoning: freshData.reasoning,
        isCachedData: true
      };

      return res.status(200).json(finalResult);

    } else {
      // --- KASUS 2: CACHE TIDAK VALID / KOSONG ---
      // Minta KEDUA rencana
      
      // --- PERUBAHAN PROMPT ---
      const promptFull = `
        Persona: 'RTC Pro Trader AI'. Konservatif, teliti, dan sangat ketat untuk 'bestOption'. Sangat disiplin dan mekanis untuk 'currentPricePlan'.

        Harga ${cryptoName} saat ini: **$${formattedPrice}**.

        TUGAS ANDA:
        Anda HARUS menghasilkan DUA output terpisah.

        1.  **Rencana 'Opsi Terbaik' (untuk \`bestOption\`):**
            * Gunakan analisis konservatif (S/R Kunci, Volume, Psikologi Pasar).
            * Cari "harga terbaik" (Limit Order) yang paling high-probability.
            * Fokus pada S/R KUNCI yang valid (terkonfirmasi Volume) yang masuk akal untuk ditunggu (pullback/retest).
            * Tentukan: \`position\`, \`entryPrice\` (harga limit), \`stopLoss\` (KETAT), \`takeProfit\` (konsisten), \`confidence\` ("High" atau "Medium").

        2.  **Rencana 'Harga Saat Ini' (untuk \`currentPricePlan\` dan \`reasoning\`):**
            * WAJIB Terapkan STRATEGI "DataTrader 5-Min Opening Range Breakout (ORB)".
            * **CEKLIS 1:** Identifikasi 'Opening Range' 5 menit terakhir yang jelas (High/Low).
            * **CEKLIS 2:** Cek apakah harga ($${formattedPrice}) sudah *tutup* di luar range itu (Breakout/Breakdown).
            * **CEKLIS 3:** Cek apakah harga ($${formattedPrice}) ada di titik entry ideal (misal: retest) atau sudah terlalu jauh.
            * **OUTPUT (Jika 3 Ceklis Lolos):** Buat \`currentPricePlan\` (Long/Short) sesuai hasil breakout.
            * **OUTPUT (Jika 1 Ceklis Gagal):** Set \`currentPricePlan\` ke \`null\`.
            * **Reasoning (untuk \`reasoning\`):** Jelaskan dalam Bahasa Indonesia hasil dari 3-langkah ceklis ORB. (Misal: "REKOMENDASI: TUNGGU. Gagal Ceklis 2: Harga masih di dalam range 5 menit. Belum ada sinyal breakout.")
            * JANGAN sebutkan 'Opsi Terbaik' di dalam reasoning.
      `;
      // --- AKHIR PROMPT ---

      console.log(`[getAnalysis] Cache TIDAK VALID. Meminta AI untuk 'bestOption' (Umum) dan 'currentPricePlan' (Mode DataTrader 5-Min ORB)...`);
      // Tipe diubah untuk mencerminkan bahwa currentPricePlan opsional
      const fullResult = await callGemini(promptFull, fullAnalysisSchema) as Omit<AnalysisResult, 'isCachedData' | 'currentPricePlan'> & { currentPricePlan?: TradePlan };


      // Simpan 'bestOption' yang baru ke cache
      try {
        await cacheRef.set(fullResult.bestOption);
        console.log(`[getAnalysis] 'bestOption' baru disimpan ke cache untuk ${cryptoId}.`);
      } catch (e) {
        console.error(`[getAnalysis] GAGAL menyimpan 'bestOption' ke cache:`, (e as Error).message);
        // Jangan hentikan proses, kirim saja datanya
      }
      
      const finalResult: AnalysisResult = {
        bestOption: fullResult.bestOption,
        // --- PERUBAHAN DI SINI ---
        currentPricePlan: fullResult.currentPricePlan || null, // Pastikan null jika tidak ada
        // --- AKHIR PERUBAHAN ---
        reasoning: fullResult.reasoning,
        isCachedData: false // Tandai bahwa ini adalah data baru
      };

      return res.status(200).json(finalResult);
    }

  } catch (error) {
    console.error("Error di Vercel function (api/getAnalysis):", error);
    const message = error instanceof Error ? error.message : "Gagal mendapatkan analisis dari AI.";
    return res.status(500).json({ error: message });
  }
}