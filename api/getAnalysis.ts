// api/getAnalysis.ts
// Impor tipe Handler dari Vercel (atau gunakan 'any' jika tidak menginstal @vercel/node)
import type { VercelRequest, VercelResponse } from '@vercel/node'; 
import { GoogleGenAI, Type } from "@google/genai";
// Pastikan path ke file types.ts Anda benar dari folder /api
import type { AnalysisResult } from '../types'; 

// 1. AMBIL API KEY DARI VERCEL ENVIRONMENT VARIABLES (AMAN)
// Ini HANYA berjalan di server, tidak pernah terlihat oleh klien
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// 2. Salin skema yang sama dari geminiService.ts lama Anda
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    position: {
      type: Type.STRING,
      description: 'The recommended trading position, either "Long" or "Short".'
    },
    entryPrice: {
      type: Type.STRING,
      description: 'The recommended entry price or range. Return ONLY the number or range (e.g., "68000-68500" or "67000"), WITHOUT any currency symbols like $.',
    },
    stopLoss: {
      type: Type.STRING,
      description: 'The recommended price for a stop-loss. Return ONLY the number (e.g., "67000"), WITHOUT any currency symbols like $.',
    },
    takeProfit: {
        type: Type.STRING,
        description: 'The recommended take-profit target. Return ONLY the number (e.g., "72000"), WITHOUT any currency symbols like $.',
    },
    confidence: {
      type: Type.STRING,
      description: 'The confidence level of this analysis (e.g., "High", "Medium", "Low").',
    },
    reasoning: {
      type: Type.STRING,
      description: 'A brief, professional rationale for the chosen price points and position, grounded in technical or market analysis principles.',
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

    // 6. --- PROMPT FINAL DENGAN SEMUA INSTRUKSI ---
    const formattedPrice = currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(4);
    const prompt = `
    Anda adalah 'RTC Pro Trader AI', seorang analis teknikal cryptocurrency yang **sangat konservatif dan sangat teliti**.
    Tugas utama Anda adalah memberikan analisis perdagangan untuk ${cryptoName} (harga saat ini $${formattedPrice}) dengan **fokus utama pada profit yang konsisten dan manajemen risiko yang ketat.**

    **Prinsip Utama (WAJIB DIPATUHI):**
    1.  **Prioritaskan Keamanan:** Lebih baik tidak trading daripada rugi.
    2.  **Profit Konsisten (Paling Penting):** Targetkan profit yang realistis dan sangat mungkin tercapai (high-probability). **Lebih baik profit kecil tapi pasti daripada target ambisius yang mungkin gagal.** Sesuai permintaan: "asal profit saja sudah cukup".
    3.  **Stop Loss Ketat:** Tentukan Stop Loss (SL) yang logis dan ketat untuk meminimalisir kerugian.
    4.  **Waspada Psikologi & Jebakan (Market Traps):** Ini adalah prioritas. Analisis HARUS mempertimbangkan kemungkinan "fakeouts" (breakout palsu), "stop loss hunt", atau "bull/bear traps". **Jangan tertipu oleh chart.** Jika sebuah pergerakan terlihat "terlalu jelas", berikan sinyal dengan sangat hati-hati atau "Low" confidence.

    **Kerangka Analisis Wajib (Teliti):**
    Analisis Anda HARUS menggabungkan beberapa prinsip inti berikut:
    1.  **Support & Resistance (S/R):** Gunakan level S/R terdekat untuk menentukan titik Entry, SL, dan TP.
    2.  **Analisis Volume:** **WAJIB** gunakan volume untuk mengkonfirmasi sinyal. Breakout dengan volume rendah adalah tanda bahaya (potensi jebakan). Pergerakan impulsif harus didukung volume kuat.
    3.  **WaveTrend Oscillator:** Fokus pada persilangan dan kondisi ekstrem (oversold/overbought) sebagai konfirmasi.
    4.  **Divergensi:** Cari divergensi bullish atau bearish pada RSI atau MFI sebagai sinyal awal.
    5.  **Momentum (MFI & RSI):** Gunakan untuk mengukur tekanan beli/jual saat ini.
    6.  **Konfluensi & Psikologi:** Berikan sinyal HANYA jika minimal 2-3 indikator di atas saling mendukung DAN sinyal tersebut masuk akal secara psikologis (bukan jebakan yang jelas).

    **Format Output:**
    -   Ikuti skema JSON yang disediakan dengan ketat.
    -   Sediakan **SATU target 'takeProfit' yang konservatif** dan masuk akal (high-probability).
    -   'confidence': Gunakan "High", "Medium", atau "Low". **Jangan ragu memberikan "Low" jika pasar volatil atau sinyal tidak kuat/terlihat seperti jebakan.**
    -   'reasoning': Berikan penjelasan singkat dan padat dalam **Bahasa Indonesia**. Jelaskan MENGAPA titik-titik itu dipilih berdasarkan kerangka analisis (misal: "Entry dekat support, SL di bawah support kuat...") **dan sebutkan secara singkat mengapa ini BUKAN jebakan (misal: 'dikonfirmasi oleh volume').**
    -   Pastikan semua harga (Entry, SL, TP) masuk akal relatif terhadap harga saat ini.
  `;
    // --- AKHIR DARI PROMPT ---

    // 7. Panggil API Gemini (secara aman di server)
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema as any,
        // --- DIKEMBALIKAN KE 0.5 SESUAI PERMINTAAN ---
        temperature: 0.5, // Sesuai instruksi: fokus pada hasil yang konsisten dan tidak "kreatif"
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