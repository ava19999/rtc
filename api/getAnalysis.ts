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
    // --- PERUBAHAN DI SINI ---
    takeProfit: {
        type: Type.STRING,
        description: 'The recommended take-profit target. Return ONLY the number (e.g., "72000"), WITHOUT any currency symbols like $.',
    },
    // --- takeProfit1 & takeProfit2 DIHAPUS ---
    confidence: {
      type: Type.STRING,
      description: 'The confidence level of this analysis (e.g., "High", "Medium", "Low").',
    },
    reasoning: {
      type: Type.STRING,
      description: 'A brief, professional rationale for the chosen price points and position, grounded in technical or market analysis principles.',
    },
  },
  // --- PERUBAHAN DI SINI ---
  required: ['position', 'entryPrice', 'stopLoss', 'takeProfit', 'confidence', 'reasoning'],
  // --- AKHIR PERUBAHAN ---
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

    // 6. Salin logika prompt Anda
    const formattedPrice = currentPrice < 0.01 ? currentPrice.toFixed(8) : currentPrice.toFixed(4);
    const prompt = `
    Anda adalah 'RTC Pro Trader AI', seorang analis teknikal cryptocurrency elit. Tugas Anda adalah memberikan analisis perdagangan untuk ${cryptoName} yang saat ini berada di harga $${formattedPrice}.

    **Kerangka Analisis Wajib:**
    Analisis Anda HARUS menggabungkan beberapa prinsip inti berikut:
    1.  **WaveTrend Oscillator:** Fokus pada persilangan dan kondisi ekstrem (oversold/overbought).
    2.  **Divergensi:** Cari divergensi bullish atau bearish pada osilator momentum seperti RSI atau MFI.
    3.  **Money Flow Index (MFI) & RSI:** Gunakan untuk mengukur momentum dan tekanan beli/jual.
    4.  **Konfirmasi Sinyal:** Berikan sinyal hanya jika ada konfluensi dari beberapa indikator.

    **Format Output:**
    -   Ikuti skema JSON yang disediakan dengan ketat.
    // --- PERUBAHAN DI SINI ---
    -   Sediakan SATU target 'takeProfit' yang realistis.
    // --- AKHIR PERUBAHAN ---
    -   Untuk 'position' dan 'confidence', GUNAKAN nilai bahasa Inggris seperti yang dicontohkan dalam skema (misalnya, "Long", "Short", "High", "Medium", "Low").
    -   Untuk 'reasoning', berikan penjelasan singkat dan padat dalam **Bahasa Indonesia**, seolah-olah Anda sedang memberi pengarahan kepada seorang trader profesional. Jelaskan logika teknis di balik titik masuk, stop loss, dan target profit.
    -   Pastikan semua titik harga yang direkomendasikan masuk akal relatif terhadap harga saat ini.
  `;

    // 7. Panggil API Gemini (secara aman di server)
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema as any,
        temperature: 0.7,
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