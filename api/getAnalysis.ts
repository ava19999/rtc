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
      description: 'A brief rationale starting with the "OPSI HARGA TERBAIK", followed by the "ANALISIS HARGA SAAT INI" (which explains the main data).',
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

    // 6. --- KATA-KATA YANG DIMINTA SUDAH DIHAPUS DARI PROMPT INI ---
    const formattedPrice = currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(4);
    const prompt = `
    Anda adalah 'RTC Pro Trader AI', seorang analis teknikal cryptocurrency yang **sangat konservatif dan sangat teliti**.
    Harga saat ini untuk ${cryptoName} adalah **$${formattedPrice}**.
    Tugas utama Anda adalah memberikan **rencana trading utama (primary plan) berdasarkan harga saat ini**, dan memberikan opsi konservatif (harga terbaik) di *bagian atas* reasoning.

    **Prinsip Utama (WAJIB DIPATUHI):**
    1.  **Prioritaskan Keamanan & Profit Konsisten.** Rencana trading utama harus memiliki SL yang ketat dan TP yang realistis (high-probability) dari harga saat ini.
    2.  **Waspada Psikologi & Jebakan (Market Traps):** Analisis HARUS mempertimbangkan kemungkinan "fakeouts" (breakout palsu) dan "stop loss hunt". Jangan tertipu oleh chart.
    3.  **Konfirmasi Volume:** **WAJIB** gunakan volume untuk mengkonfirmasi sinyal.

    **Kerangka Analisis Wajib (Teliti):**
    1.  **Analisis Harga Saat Ini (Rencana Utama):**
        * Tentukan apakah masuk di **$${formattedPrice}** (harga saat ini) adalah tindakan yang logis.
        * Tentukan \`entryPrice\` (sebagai $${formattedPrice} atau rentang sangat dekat), \`stopLoss\` (ketat), dan \`takeProfit\` (konservatif) untuk rencana ini. Data ini akan mengisi data JSON utama.
        * Jika masuk di harga saat ini terlalu berisiko, atur \`confidence\` ke "Low".
    2.  **Analisis Harga Terbaik (Rencana Opsi):**
        * Cari "harga terbaik" (Limit Order) yang **LEBIH KONSERVATIF LAGI** dan **LEBIH BAGUS** (Risk/Reward lebih baik).
        * Ini berarti **menunggu pullback yang lebih dalam ke level support yang SANGAT KUAT (untuk Long)** atau rally ke resistance SANGAT KUAT (untuk Short), bukan hanya S/R terdekat.
        * Rencana "harga terbaik" ini HANYA akan dimasukkan ke bagian *atas* dari \`reasoning\`.

    **Format Output:**
    -   Ikuti skema JSON yang disediakan dengan ketat.
    -   \`entryPrice\`, \`stopLoss\`, \`takeProfit\`: HARUS mencerminkan RENCANA UTAMA (berdasarkan harga saat ini $${formattedPrice}).
    -   \`confidence\`: "High", "Medium", atau "Low" untuk RENCANA UTAMA (harga saat ini).
    -   \`reasoning\`: 
        1.  **Bagian Pertama (DI ATAS):** Mulai dengan bagian "OPSI HARGA TERBAIK:". Jelaskan rencana "harga terbaik" (Limit Order) yang paling aman ini. Tekankan bahwa ini adalah **opsi paling aman** untuk R/R terbaik. (Misal: "OPSI HARGA TERBAIK: Rencana paling aman adalah menunggu pullback lebih dalam ke [harga terbaik]... Ini adalah level support kuat mingguan. Idealnya tunggu konfirmasi pantulan/volume di area ini sebelum masuk. SL di [SL terbaik]... TP di [TP terbaik]."). Ini adalah rencana yang "bertahan hingga SL atau TP tercapai".
        2.  **Bagian Kedua (DI BAWAH):** Tambahkan bagian baru "ANALISIS HARGA SAAT INI:".
        3.  Di bagian baru ini, jelaskan rencana/konservasi untuk **"Harga Saat Ini"** ($${formattedPrice}), yang datanya Anda masukkan di data utama (entryPrice, stopLoss, takeProfit). (Misal: "ANALISIS HARGA SAAT INI: Masuk di $${formattedPrice} memiliki risiko [sebutkan risiko, misal: 'nanggung']... SL di [SL utama] untuk antisipasi... TP konservatif di [TP utama]...").
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