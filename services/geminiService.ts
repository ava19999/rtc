// services/geminiService.ts

// HAPUS import GoogleGenAI dan Type, karena sudah pindah ke server
// import { GoogleGenAI, Type } from "@google/genai"; 
import type { AnalysisResult } from '../types';

// HAPUS inisialisasi 'ai'
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// HAPUS 'analysisSchema', karena sudah pindah ke server
// const analysisSchema = { ... };

export const fetchCryptoAnalysis = async (cryptoName: string, currentPrice: number): Promise<AnalysisResult> => {
  // HAPUS pengecekan API_KEY di sisi klien
  // if (!process.env.API_KEY) { ... }

  try {
    // PANGGIL SERVERLESS FUNCTION VERCEL YANG BARU KITA BUAT
    // Vercel secara otomatis mengarahkan /api/getAnalysis ke file api/getAnalysis.ts
    const response = await fetch('/api/getAnalysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Kirim data yang dibutuhkan oleh function
      body: JSON.stringify({
        cryptoName: cryptoName,
        currentPrice: currentPrice,
      }),
    });

    if (!response.ok) {
      // Jika server function error, tangkap pesannya
      const errorData = await response.json().catch(() => ({})); // Tangkap jika respons bukan JSON
      const errorMessage = errorData.error || `Error: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    // Kembalikan JSON langsung dari server function kita
    const result: AnalysisResult = await response.json();
    return result;

  } catch (error) {
    console.error("Error fetching analysis from /api/getAnalysis:", error);
    // Teruskan pesan error yang ramah
    const message = error instanceof Error ? error.message : "Gagal mendapatkan analisis dari AI.";
    throw new Error(message);
  }
};