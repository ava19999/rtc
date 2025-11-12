// api/getAnalysis.ts
// Impor tipe Handler dari Vercel (atau gunakan 'any' jika tidak menginstal @vercel/node)
import type { VercelRequest, VercelResponse } from '@vercel/node'; 
import { GoogleGenAI, Type } from "@google/genai";
// Pastikan path ke file types.ts Anda benar dari folder /api
import type { AnalysisResult } from '../types'; 

// 1. AMBIL API KEY DARI VERCEL ENVIRONMENT VARIABLES (AMAN)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// 2. SKEMA DATA UTAMA (TETAP FOKUS PADA HARGA SAAT INI - TIDAK DIUBAH)
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    position: {
      type: Type.STRING,
      description: 'The recommended trading position, either "Long" or "Short".'
    },
    entryPrice: {
      type: Type.STRING,
      // Data utama adalah untuk HARGA SAAT INI
      description: 'The recommended entry price based on the CURRENT MARKET PRICE, or a very tight range around it. Return ONLY the number or range (e.g., "68000-68100" or "67000"), WITHOUT any currency symbols like $.',
    },
    stopLoss: {
      type: Type.STRING,
      description: 'The recommended price for a stop-loss (relative to the entryPrice). Return ONLY the number (e.g., "67000"), WITHOUT any currency symbols like $.',
    },
    takeProfit: {
        type: Type.STRING,
        description: 'The recommended take-profit target (relative to the entryPrice). Return ONLY the number (e.g., "72000"), WITHOUT any currency symbols like $.',
    },
    confidence: {
      type: Type.STRING,
      description: 'The confidence level for the CURRENT MARKET PRICE plan (e.g., "High", "Medium", "Low").',
    },
    reasoning: {
      type: Type.STRING,
      // Deskripsi reasoning diubah untuk mencerminkan urutan BARU
      description: 'A brief rationale starting with the "OPSI ENTRY TERBAIK", followed by the "ANALISIS HARGA SAAT INI".',
    },
  },
  required: ['position', 'entryPrice', 'stopLoss', 'takeProfit', 'confidence', 'reasoning'],
};

// 3. Buat handler untuk Vercel
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Hanya izinkan metode POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // 4. Ambil data dari body permintaan (client)
    const { cryptoName, currentPrice } = req.body;

    if (!cryptoName || currentPrice === undefined) {
      return res.status(400).json({ error: 'cryptoName dan currentPrice diperlukan' });
    }
    
    // 5. Pastikan API Key ada di server
    if (!process.env.API_KEY) {
        throw new Error("Kunci API Gemini tidak dikonfigurasi di Vercel.");
    }

    // 6. --- PROMPT BARU DENGAN TONE PRO, GEN Z, & DEDIKASI (FRASA DIHAPUS) ---
    const formattedPrice = currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(4);
    const prompt = `
    Anda adalah 'RTC Pro Trader AI', analis teknikal *dedicated* dari RTC. Misi utama Anda adalah menganalisis chart dengan **sangat teliti (no mercy on traps)**. Anda adalah trader konservatif yang mengutamakan **profit konsisten, *no matter how small*.**

    Harga saat ini untuk ${cryptoName} adalah **$${formattedPrice}**.

    **Prinsip Utama (WAJIB DIPATUHI):**
    1.  **Anti-Jebakan (No Traps):** Waspada penuh terhadap psikologi pasar. Analisis HARUS mendeteksi "fakeouts", "stop loss hunt", dan "bull/bear traps". Jangan sampai tertipu chart.
    2.  **Konfirmasi Wajib (Volume & S/R):** Sinyal tanpa konfirmasi volume kuat atau S/R yang valid = *red flag*.
    3.  **Rencana Utama (Harga Saat Ini):** Data JSON utama (\`entryPrice\`, \`stopLoss\`, \`takeProfit\`) HARUS untuk rencana masuk di **$${formattedPrice}**.
    4.  **Rencana Opsi (Harga Terbaik):** Rencana *limit order* yang lebih *high-probability* akan dibahas di *reasoning*.

    **Kerangka Analisis Wajib (Teliti):**
    1.  **Analisis Harga Saat Ini (Rencana Utama):**
        * Tentukan apakah masuk di **$${formattedPrice}** (harga saat ini) adalah tindakan yang logis.
        * Tentukan \`entryPrice\` (sebagai $${formattedPrice}), \`stopLoss\` (ketat), dan \`takeProfit\` (konservatif) untuk rencana ini. Data ini akan mengisi data JSON utama.
        * Jika masuk di harga saat ini terlalu berisiko, atur \`confidence\` ke "Low".
    2.  **Analisis Harga Terbaik (Rencana Opsi - SANGAT KONSERVATIF):**
        * Cari "harga terbaik" (Limit Order) yang **LEBIH KONSERVATIF LAGI** dan **LEBIH BAGUS** (Risk/Reward lebih baik).
        * Ini berarti **menunggu pullback yang lebih dalam ke level support yang SANGAT KUAT (untuk Long)** atau rally ke resistance SANGAT KUAT (untuk Short).
        * Rencana "harga terbaik" ini HANYA akan dimasukkan ke bagian *atas* dari \`reasoning\`.

    **Format Output:**
    -   Ikuti skema JSON yang disediakan dengan ketat.
    -   \`entryPrice\`, \`stopLoss\`, \`takeProfit\`: HARUS mencerminkan RENCANA UTAMA (berdasarkan harga saat ini $${formattedPrice}).
    -   \`confidence\`: "High", "Medium", atau "Low" untuk RENCANA UTAMA (harga saat ini).
    -   \`reasoning\`: 
        1.  **Bagian Pertama (DI ATAS):** Mulai dengan *heading* "OPSI ENTRY TERBAIK:". Jelaskan rencana *limit order* ini dengan *pro* dan jelas. Ini adalah skenario *high-probability* yang ditunggu (rencana yang "bertahan hingga SL atau TP tercapai"). (Misal: "OPSI ENTRY TERBAIK: Rencana paling *proper* adalah nunggu *pullback* ke [harga terbaik]... Ini *strong support* yang valid. *Watchlist* area ini untuk konfirmasi volume/pantulan sebelum *entry*. SL di [SL terbaik]... TP di [TP terbaik].").
        2.  **Bagian Kedua (DI BAWAH):** Tambahkan *heading* "ANALISIS HARGA SAAT INI:".
        3.  Di bagian ini, jelaskan rencana konservatif untuk **"Harga Saat Ini"** ($${formattedPrice})—yang datanya ada di JSON utama. (Misal: "ANALISIS HARGA SAAT INI: Kalau *FOMO* dan mau masuk sekarang di $${formattedPrice}, risikonya [sebutkan risiko, misal: 'agak nanggung']. *Setup* ini (SL di [SL utama] dan TP di [TP utama]) adalah *trade plan* paling *safe* untuk *secure* profit cepat.").
  `;
    // --- AKHIR DARI PROMPT ---

    // 7. Panggil API Gemini (secara aman di server)
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema as any,
        // --- SUHU 0.5 UNTUK ANALISIS FOKUS & KONSEVATIF ---
        temperature: 0.5, 
      },
    });

    const jsonString = (response.text ?? '').trim();
    if (!jsonString) {
      throw new Error("Respons AI kosong.");
    }
    
    const result = JSON.parse(jsonString) as AnalysisResult;

    // 8. Kembalikan hasil ke client
    return res.status(200).json(result);

  } catch (error) {
    console.error("Error di Vercel function (api/getAnalysis):", error);
    const message = error instanceof Error ? error.message : "Gagal mendapatkan analisis dari AI.";
    return res.status(500).json({ error: message });
  }
}