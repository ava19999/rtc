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

// 3. Skema untuk meminta KEDUA rencana (Cache Tidak Valid)
// 'currentPricePlan' dibuat opsional (dihapus dari 'required')
const fullAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    bestOption: {
      ...tradePlanSchema,
      description: "The high-probability, high R:R, 'best price' limit order plan. This is the plan to be cached."
    },
    currentPricePlan: {
      ...tradePlanSchema,
      description: "The scalping plan for the current price. Omit this field (set to null) if the 3-step check fails (recommends 'WAIT')."
    },
    reasoning: {
      type: Type.STRING,
      description: "A brief, clear rationale in Indonesian *only* for the 'currentPricePlan'. Explain why the 3-step scalping check passed or FAILED."
    },
  },
  required: ['bestOption', 'reasoning'], 
};

// 4. Skema untuk meminta HANYA rencana harga saat ini (Cache Valid)
// 'currentPricePlan' dibuat opsional (dihapus dari 'required')
const currentPriceOnlySchema = {
    type: Type.OBJECT,
    properties: {
      currentPricePlan: {
        ...tradePlanSchema,
        description: "The scalping plan for the current price. Omit this field (set to null) if the 3-step check fails (recommends 'WAIT')."
      },
      reasoning: {
        type: Type.STRING,
        description: "A brief, clear rationale in Indonesian *only* for the 'currentPricePlan'. Explain why the 3-step scalping check passed or FAILED."
      },
    },
    required: ['reasoning'], 
};


// Fungsi helper untuk memanggil AI
async function callGemini(prompt: string, schema: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
      temperature: 0.5,
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

    // --- LOGIKA CACHE (Tetap sama) ---
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
      // Minta HANYA 'currentPricePlan' dan 'reasoning'-nya menggunakan LOGIKA BARU
      
      // --- PROMPT BARU (LEBIH AMAN) ---
      const promptCurrentOnly = `
        Persona: 'RTC Pro Trader AI'. Anda adalah scalper 5 menit yang disiplin dan realistis.
        
        STRATEGI WAJIB (3-LANGKAH KONFLUENS):
        1.  Konteks (Tren 1 Jam): Cek tren utama (misal: 1H EMA 50). JANGAN melawan tren ini.
        2.  Zona (S/R 5-Menit): Harga HARUS berada di zona Support/Resistance (S/R) 5 menit yang valid.
        3.  Konfirmasi (RSI/Momentum): HARUS ada konfirmasi (misal: RSI oversold di support saat uptrend).

        Harga ${cryptoName} saat ini: **$${formattedPrice}**.

        TUGAS:
        Analisis harga saat ini ($${formattedPrice}) menggunakan 3-Langkah Konfluens di atas.

        1.  **Jika SEMUA 3 langkah terpenuhi (Konteks, Zona, Konfirmasi):**
            * Buat \`currentPricePlan\` (Long/Short) dengan SL ketat dan TP realistis (misal 1.5R).
            * Set \`confidence\` ke "Medium" atau "High".
            * Di \`reasoning\`: Jelaskan bahwa 3 ceklis lolos (Misal: "Sinyal LONG: Tren 1 Jam Bullish, harga memantul di Support 5-Menit, dan RSI Oversold.").

        2.  **Jika SATU SAJA langkah gagal:**
            * Set \`currentPricePlan\` ke \`null\`.
            * Di \`reasoning\`: Jelaskan dengan TEPAT mengapa gagal dan sarankan "TUNGGU".
            * (Contoh Gagal Cek 2: "REKOMENDASI: TUNGGU. Tren 1 Jam Bullish, tapi harga saat ini di 'no-man's-land' (jauh dari support). Tunggu pullback ke support.")
            * (Contoh Gagal Cek 1: "REKOMENDASI: TUNGGU. Harga di support 5-menit, tapi tren 1 Jam masih Bearish. Terlalu berisiko untuk Long.")
      `;
      // --- AKHIR PROMPT BARU ---
      
      console.log(`[getAnalysis] Cache VALID. Menjalankan AI (Mode Scalping 3-Langkah) untuk harga saat ini...`);
      const freshData = await callGemini(promptCurrentOnly, currentPriceOnlySchema);

      const finalResult: AnalysisResult = {
        bestOption: cachedBestOption,
        currentPricePlan: freshData.currentPricePlan || null, // Pastikan null jika tidak ada
        reasoning: freshData.reasoning,
        isCachedData: true
      };

      return res.status(200).json(finalResult);

    } else {
      // --- KASUS 2: CACHE TIDAK VALID / KOSONG ---
      // Minta KEDUA rencana
      
      // --- PROMPT BARU (LEBIH AMAN) ---
      const promptFull = `
        Persona: 'RTC Pro Trader AI'. Konservatif untuk 'bestOption', Disiplin untuk 'currentPricePlan'.

        Harga ${cryptoName} saat ini: **$${formattedPrice}**.

        TUGAS ANDA:
        Anda HARUS menghasilkan DUA output terpisah.

        1.  **Rencana 'Opsi Terbaik' (untuk \`bestOption\`):**
            * Gunakan analisis konservatif (S/R Kunci Harian/4 Jam, Volume, Psikologi Pasar).
            * Cari "harga terbaik" (Limit Order) yang paling high-probability.
            * Fokus pada S/R KUNCI yang valid (terkonfirmasi Volume) yang masuk akal untuk ditunggu (pullback/retest).
            * Tentukan: \`position\`, \`entryPrice\` (harga limit), \`stopLoss\` (KETAT), \`takeProfit\` (konsisten), \`confidence\` ("High" atau "Medium").

        2.  **Rencana 'Harga Saat Ini' (untuk \`currentPricePlan\` dan \`reasoning\`):**
            * WAJIB Terapkan STRATEGI SCALPING 3-LANGKAH KONFLUENS (Konteks, Zona, Konfirmasi).
            * **CEK 1 (Konteks):** Cek tren 1 Jam.
            * **CEK 2 (Zona):** Cek apakah harga ($${formattedPrice}) di S/R 5-menit yang valid.
            * **CEK 3 (Konfirmasi):** Cek apakah ada konfirmasi momentum/RSI di zona tersebut.
            *
            * **OUTPUT (Jika 3 Ceklis Lolos):** Buat \`currentPricePlan\` (Long/Short) sesuai hasil konfluens.
            * **OUTPUT (Jika 1 Ceklis Gagal):** Set \`currentPricePlan\` ke \`null\`.
            * **Reasoning (untuk \`reasoning\`):** Jelaskan dalam Bahasa Indonesia hasil dari 3-langkah ceklis. (Misal: "REKOMENDASI: TUNGGU. Gagal Cek 2: Harga di 'no-man's-land'. Tunggu pullback ke support 5-menit.").
            * JANGAN sebutkan 'Opsi Terbaik' di dalam reasoning.
      `;
      // --- AKHIR PROMPT BARU ---

      console.log(`[getAnalysis] Cache TIDAK VALID. Meminta AI untuk 'bestOption' (Umum) dan 'currentPricePlan' (Mode Scalping 3-Langkah)...`);
      const fullResult = await callGemini(promptFull, fullAnalysisSchema) as Omit<AnalysisResult, 'isCachedData' | 'currentPricePlan'> & { currentPricePlan?: TradePlan };


      // Simpan 'bestOption' yang baru ke cache
      try {
        await cacheRef.set(fullResult.bestOption);
        console.log(`[getAnalysis] 'bestOption' baru disimpan ke cache untuk ${cryptoId}.`);
      } catch (e) {
        console.error(`[getAnalysis] GAGAL menyimpan 'bestOption' ke cache:`, (e as Error).message);
      }
      
      const finalResult: AnalysisResult = {
        bestOption: fullResult.bestOption,
        currentPricePlan: fullResult.currentPricePlan || null, // Pastikan null jika tidak ada
        reasoning: fullResult.reasoning,
        isCachedData: false 
      };

      return res.status(200).json(finalResult);
    }

  } catch (error) {
    console.error("Error di Vercel function (api/getAnalysis):", error);
    const message = error instanceof Error ? error.message : "Gagal mendapatkan analisis dari AI.";
    return res.status(500).json({ error: message });
  }
}