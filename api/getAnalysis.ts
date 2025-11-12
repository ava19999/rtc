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

// --- PERUBAHAN SKEMA DIMULAI ---

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
const fullAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    bestOption: {
      ...tradePlanSchema,
      description: "The high-probability, high R:R, 'best price' limit order plan. This is the plan to be cached."
    },
    currentPricePlan: {
      ...tradePlanSchema,
      description: "The trade plan for entering at the current market price."
    },
    reasoning: {
      type: Type.STRING,
      description: "A brief, clear rationale in Indonesian *only* for the 'currentPricePlan'. Explain its risks, SL, and TP. DO NOT mention the 'bestOption' here."
    },
  },
  required: ['bestOption', 'currentPricePlan', 'reasoning'],
};

// 4. Skema untuk meminta HANYA rencana harga saat ini (Cache Valid)
const currentPriceOnlySchema = {
    type: Type.OBJECT,
    properties: {
      currentPricePlan: {
        ...tradePlanSchema,
        description: "The trade plan for entering at the current market price."
      },
      reasoning: {
        type: Type.STRING,
        description: "A brief, clear rationale in Indonesian *only* for the 'currentPricePlan'. Explain its risks, SL, and TP."
      },
    },
    required: ['currentPricePlan', 'reasoning'],
};

// --- PERUBAHAN SKEMA SELESAI ---


// Fungsi helper untuk memanggil AI
async function callGemini(prompt: string, schema: any) {
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
      temperature: 0.3,
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
      
      const promptCurrentOnly = `
        Persona: 'RTC Pro Trader AI'. Fokus pada high-probability setup dan konservatif.
        Harga ${cryptoName} saat ini: **$${formattedPrice}**.
        
        TUGAS:
        1.  **Rencana 'Harga Saat Ini' (untuk 'currentPricePlan'):**
            * Tentukan rencana paling logis (Long/Short) jika harus masuk SEKARANG di **$${formattedPrice}**.
            * Tentukan: \`position\`, \`entryPrice\` (gunakan $${formattedPrice}), \`stopLoss\`, \`takeProfit\`, \`confidence\`.
            * Jika masuk sekarang sangat berisiko, set \`confidence\` ke "Low".
        2.  **Penjelasan (untuk 'reasoning'):**
            * Berikan penjelasan SINGKAT dan LUGAS dalam Bahasa Indonesia *hanya* untuk 'Rencana Harga Saat Ini' di atas.
      `;
      
      console.log(`[getAnalysis] Cache VALID. Meminta AI HANYA untuk rencana harga saat ini...`);
      const freshData = await callGemini(promptCurrentOnly, currentPriceOnlySchema);

      const finalResult: AnalysisResult = {
        bestOption: cachedBestOption,
        currentPricePlan: freshData.currentPricePlan,
        reasoning: freshData.reasoning,
        isCachedData: true
      };

      return res.status(200).json(finalResult);

    } else {
      // --- KASUS 2: CACHE TIDAK VALID / KOSONG ---
      // Minta KEDUA rencana
      
      const promptFull = `
        Persona: 'RTC Pro Trader AI'. Fokus pada high-probability setup, konservatif, dan manajemen risiko.
        Harga ${cryptoName} saat ini: **$${formattedPrice}**.

        TUGAS ANDA:
        Anda HARUS menghasilkan DUA rencana trading terpisah dalam format JSON yang diminta.

        1.  **Rencana 'Opsi Terbaik' (untuk \`bestOption\`):**
            * Cari "harga terbaik" (Limit Order) yang paling high-probability, konservatif, dan R:R terbaik untuk profit paling pasti.
            * Ini adalah level S/R KUNCI yang valid dan kuat, yang masuk akal untuk ditunggu (pullback/retest).
            * Tentukan: \`position\`, \`entryPrice\` (harga limit order), \`stopLoss\`, \`takeProfit\`, \`confidence\` untuk rencana ini.

        2.  **Rencana 'Harga Saat Ini' (untuk \`currentPricePlan\`):**
            * Tentukan rencana paling logis (Long/Short) jika harus masuk SEKARANG di **$${formattedPrice}**.
            * Tentukan: \`position\`, \`entryPrice\` (gunakan $${formattedPrice}), \`stopLoss\`, \`takeProfit\`, \`confidence\` untuk rencana ini.

        3.  **Penjelasan (untuk \`reasoning\`):**
            * Berikan penjelasan SINGKAT dan LUGAS dalam Bahasa Indonesia *hanya* untuk 'Rencana Harga Saat Ini' (poin 2).
            * JANGAN sebutkan 'Opsi Terbaik' di dalam reasoning.
      `;

      console.log(`[getAnalysis] Cache TIDAK VALID. Meminta AI untuk KEDUA rencana...`);
      const fullResult = await callGemini(promptFull, fullAnalysisSchema) as Omit<AnalysisResult, 'isCachedData'>;

      // Simpan 'bestOption' yang baru ke cache
      try {
        await cacheRef.set(fullResult.bestOption);
        console.log(`[getAnalysis] 'bestOption' baru disimpan ke cache untuk ${cryptoId}.`);
      } catch (e) {
        console.error(`[getAnalysis] GAGAL menyimpan 'bestOption' ke cache:`, (e as Error).message);
        // Jangan hentikan proses, kirim saja datanya
      }
      
      const finalResult: AnalysisResult = {
        ...fullResult,
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