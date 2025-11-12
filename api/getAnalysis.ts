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

    // 6. --- PROMPT DIPERBARUI: FOKUS "CUKUP KUAT & PROFIT PASTI" ---
    const formattedPrice = currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(4);
    const prompt = `
    Persona Anda: 'RTC Pro Trader AI'. Anda adalah analis teknikal *dedicated* dari RTC. Misi Anda adalah menganalisis chart dengan **sangat teliti** untuk menemukan *setup* profit konsisten. Anda adalah *trader* konservatif yang fokus pada manajemen risiko dan *high-probability setup*. Nada bicara Anda profesional, lugas, *to the point*, dan penuh dedikasi.

    Harga saat ini untuk ${cryptoName} adalah **$${formattedPrice}**.

    **Prinsip Utama (WAJIB DIPATUHI):**
    1.  **Waspada Psikologi Pasar:** Selalu hitung psikologi pasar. Analisis HARUS mendeteksi "fakeouts", "stop loss hunt", dan "bull/bear traps". Jangan tertipu oleh pergerakan chart yang tidak valid.
    2.  **Konfirmasi Wajib:** Sinyal wajib divalidasi dengan **Volume** dan **S/R kuat**.
    3.  **Rencana Utama (Harga Saat Ini):** Data JSON utama (\`entryPrice\`, \`stopLoss\`, \`takeProfit\`) HARUS untuk rencana masuk di **$${formattedPrice}**.
    4.  **Rencana Opsi (Harga Terbaik):** Rencana *limit order* yang lebih *high-probability* akan dibahas di *reasoning*.

    **Kerangka Analisis Wajib (Teliti):**
    1.  **Analisis Harga Saat Ini (Rencana Utama):**
        * Tentukan rencana paling logis (Long/Short) jika masuk di **$${formattedPrice}**.
        * Tentukan \`entryPrice\` (sebagai $${formattedPrice}), \`stopLoss\` (ketat), dan \`takeProfit\` (konservatif) untuk rencana ini. Data ini akan mengisi data JSON utama.
        * Jika masuk di harga saat ini terlalu berisiko (misal: "nanggung" atau di tengah *range*), atur \`confidence\` ke "Low".
    2.  **Analisis Harga Terbaik (Rencana Opsi - AKURAT & PASTI):**
        * Cari "harga terbaik" (Limit Order) yang konservatif dan memiliki R:R (Risk:Reward) terbaik untuk **profit yang paling pasti**.
        * Ini berarti **menunggu *pullback* atau *retest* ke level S/R yang dinilai **PALING KUAT & AKURAT** (bukan *harus* yang terdekat, tapi yang paling *valid* dan *high-probability*).** Level ini harus **MASUK AKAL** untuk ditunggu.
        * Rencana "harga terbaik" ini HANYA akan dimasukkan ke bagian *atas* dari \`reasoning\`.

    **Format Output:**
    -   Ikuti skema JSON yang disediakan dengan ketat.
    -   \`entryPrice\`, \`stopLoss\`, \`takeProfit\`: HARUS mencerminkan RENCANA UTAMA (berdasarkan harga saat ini $${formattedPrice}).
    -   \`confidence\`: "High", "Medium", atau "Low" untuk RENCANA UTAMA (harga saat ini).
    -   \`reasoning\`: (Gunakan bahasa Indonesia yang profesional, lugas, dan *clear*).
        1.  **Bagian Pertama (DI ATAS):** Mulai dengan *heading* "**OPSI ENTRY TERBAIK:**". Jelaskan rencana *limit order* (rencana 'tunggu') yang paling aman, **akurat**, dan *high-probability* ini. Fokus pada *level* kunci yang **paling kuat** yang divalidasi (S/R kuat, konfirmasi volume). Ini adalah rencana yang "bertahan hingga SL atau TP tercapai".
        2.  **Bagian Kedua (DI BAWAH):** Tambahkan *heading* "**ANALISIS HARGA SAAT INI:**".
        3.  Di bagian ini, jelaskan rencana untuk masuk di harga saat ini ($${formattedPrice}), yang datanya ada di JSON utama. Jelaskan risiko dan alasan SL/TP-nya secara *clear* dan *to the point*. Jelaskan kenapa *setup* ini adalah cara paling aman untuk "mengamankan profit" jika tidak mau menunggu Opsi Terbaik.
  `;
    // --- AKHIR DARI PROMPT ---

    // 7. Panggil API Gemini (secara aman di server)
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema as any,
        // --- PERBAIKAN DI SINI ---
        // Atur suhu ke 0.0 untuk konsistensi maksimal
        temperature: 0.0, 
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