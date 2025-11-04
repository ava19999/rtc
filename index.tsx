// ava19999/v1/v1-3bbf7b9709343acdbf7b99c90dc3548f8b760845/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './index.css'; // <-- TAMBAHKAN BARIS INI

// --- PERBAIKAN DI SINI ---
// Deteksi 'AndroidBridge' yang Anda inject dari MainActivity.java
const isNativeApp = (window as any).AndroidBridge !== undefined;
// -------------------------

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const root = ReactDOM.createRoot(rootElement); // Buat root di sini

if (!googleClientId) {
  // Render pesan error jika Client ID tidak ada
  const ErrorComponent = () => (
    <div style={{ color: 'white', backgroundColor: '#0A0A0A', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ border: '1px solid #FF00FF', padding: '20px', borderRadius: '8px', textAlign: 'center', maxWidth: '500px' }}>
        <h1 style={{ color: '#FF00FF', fontSize: '24px' }}>Kesalahan Konfigurasi</h1>
        <p style={{ marginTop: '10px', lineHeight: '1.6' }}>
            Variabel lingkungan <strong>GOOGLE_CLIENT_ID</strong> tidak ditemukan.
            Harap konfigurasikan variabel ini di pengaturan situs Netlify Anda atau di dalam file <code>.env</code> lokal Anda untuk mengaktifkan login Google.
        </p>
      </div>
    </div>
  );
  root.render(<ErrorComponent />); // Render komponen error
  console.error("GOOGLE_CLIENT_ID is not defined...");
} else {
  // --- PERBAIKAN LOGIKA DI SINI ---
  
  if (isNativeApp) {
    // 1. JIKA INI NATIVE APP (ADA BRIDGE), jangan bungkus dengan Provider
    console.log("Mode Native Android terdeteksi (via AndroidBridge), GoogleOAuthProvider DILEWATI.");
    const AppRoot = (
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    root.render(AppRoot);
  } else {
    // 2. JIKA INI WEB BROWSER, bungkus dengan Provider
    console.log("Mode Web Browser terdeteksi, GoogleOAuthProvider DIBUNGKUS.");
    const AppRoot = (
      <React.StrictMode>
        <GoogleOAuthProvider clientId={googleClientId as string}>
          <App />
        </GoogleOAuthProvider>
      </React.StrictMode>
    );
    root.render(AppRoot);
  }
}