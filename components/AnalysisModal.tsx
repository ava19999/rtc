// AnalysisModal.tsx
import React, { useState } from 'react';
// --- PERUBAHAN DIMULAI ---
import type { AnalysisModalProps, AnalysisResult, Currency, ExchangeTicker, TradePlan } from '../types';
// --- AKHIR PERUBAHAN ---

const formatUsd = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 18,
  }).format(price);
};

const formatIdr = (value: number): string => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const parseAndConvertPrice = (priceString: string, rate: number | null, displayCurrency: Currency) => {
  const cleanedString = String(priceString).replace(/[\$,]/g, '').trim();

  if (cleanedString.includes('-')) {
    const parts = cleanedString.split('-').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const usdRange = parts.map(formatUsd).join(' - ');
      if (rate) {
        const idrRange = parts.map(p => formatIdr(p * rate)).join(' - ');
        return displayCurrency === 'idr' ? { primary: idrRange, secondary: usdRange } : { primary: usdRange, secondary: idrRange };
      }
      return { primary: usdRange, secondary: 'Memuat kurs...' };
    }
  }

  const num = parseFloat(cleanedString);
  if (!isNaN(num)) {
    const usdValue = formatUsd(num);
    if (rate) {
      const idrValue = formatIdr(num * rate);
      return displayCurrency === 'idr' ? { primary: idrValue, secondary: usdValue } : { primary: usdValue, secondary: idrValue };
    }
    return { primary: usdValue, secondary: 'Memuat kurs...' };
  }

  return { primary: priceString, secondary: 'Format tidak valid' };
};

const ProfitAnimation = () => (
    <div className="flex flex-col items-center justify-center space-y-3 py-4">
        <div className="relative w-24 h-20 flex items-end justify-center gap-1 overflow-hidden">
            <div className="w-4 h-1/4 bg-lime/50 rounded-t-sm animate-grow" style={{ animationDelay: '0s' }}></div>
            <div className="w-4 h-1/2 bg-lime/70 rounded-t-sm animate-grow" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-4 h-3/4 bg-lime rounded-t-sm animate-grow" style={{ animationDelay: '0.4s' }}></div>
            <div className="w-4 h-1/3 bg-lime/60 rounded-t-sm animate-grow" style={{ animationDelay: '0.6s' }}></div>
            <div className="absolute top-full left-1/4 w-1.5 h-1.5 bg-lime rounded-full opacity-0 animate-float" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute top-full left-1/2 w-1 h-1 bg-lime rounded-full opacity-0 animate-float" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-full left-3/4 w-2 h-2 bg-lime rounded-full opacity-0 animate-float" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <p className="text-lime text-sm tracking-wider font-semibold text-center">Menganalisis Potensi Keuntungan...</p>
    </div>
);

const TickerLoadingSpinner = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center justify-center space-y-1.5 py-6">
    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-electric/50"></div>
    <p className="text-gray-400 text-xs">{text}</p>
  </div>
);

const ErrorDisplay = ({ title, message }: { title: string, message: string }) => (
    <div className="flex flex-col items-center justify-center text-center p-3 bg-magenta/10 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-magenta mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-base font-semibold text-magenta">{title}</p>
        <p className="text-gray-400 text-xs mt-0.5">{message}</p>
    </div>
);

// --- PERUBAHAN DIMULAI ---

/**
 * Sub-komponen baru untuk menampilkan satu rencana trading.
 */
const PlanDisplay: React.FC<{ 
  plan: TradePlan, 
  title: string, 
  idrRate: number | null, 
  currency: Currency, 
  isCached?: boolean 
}> = ({ plan, title, idrRate, currency, isCached }) => {
    
    const { position, entryPrice, stopLoss, takeProfit, confidence } = plan;
    const isLong = position === 'Long';
    
    const entry = parseAndConvertPrice(entryPrice, idrRate, currency);
    const stop = parseAndConvertPrice(stopLoss, idrRate, currency);
    const profit = parseAndConvertPrice(takeProfit, idrRate, currency);

    const confidenceStyles: { [key: string]: string } = {
        High: 'bg-lime/20 text-lime',
        Medium: 'bg-electric/20 text-electric',
        Low: 'bg-yellow-500/20 text-yellow-400',
    };
    const confidenceText = confidence || 'N/A';
    const styleClass = confidenceStyles[confidenceText] || 'bg-white/10 text-gray-100';

    return (
        <div className="space-y-2.5 w-full">
            {/* Judul Rencana dan Badge Cache */}
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-gray-200">{title}</h4>
                {isCached !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isCached 
                            ? 'bg-electric/20 text-electric' 
                            : 'bg-lime/20 text-lime'
                    }`}>
                        {isCached ? 'Dari Cache' : 'Analisis Baru'}
                    </span>
                )}
            </div>
            
            {/* Detail Posisi dan Keyakinan */}
            <div className={`relative p-2.5 rounded-lg ${isLong ? 'bg-gradient-to-br from-lime/10 to-lime/5' : 'bg-gradient-to-br from-magenta/10 to-magenta/5'}`}>
                 <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                        <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${isLong ? 'bg-lime/20 text-lime' : 'bg-magenta/20 text-magenta'}`}>
                             {isLong ? 
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg> :
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                             }
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-400">Rekomendasi Posisi</p>
                            <p className={`text-lg font-black ${isLong ? 'text-lime' : 'text-magenta'}`}>
                                {position}
                            </p>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-medium text-gray-400">Keyakinan</p>
                        <span className={`inline-block text-xs font-semibold px-1.5 py-0.5 rounded-full ${styleClass}`}>{confidenceText}</span>
                    </div>
                </div>
            </div>

            {/* Harga-harga */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-center">
                <div className="bg-white/5 p-1.5 rounded-lg">
                    <p className="text-xs font-medium text-gray-400">Harga Masuk</p>
                    <p className="text-xs font-semibold text-electric break-words">{entry.primary}</p>
                    <p className="text-xs text-gray-500">{entry.secondary}</p>
                </div>
                <div className="bg-white/5 p-1.5 rounded-lg">
                    <p className="text-xs font-medium text-gray-400">Stop Loss</p>
                    <p className="text-xs font-semibold text-magenta">{stop.primary}</p>
                    <p className="text-xs text-gray-500">{stop.secondary}</p>
                </div>
                <div className="bg-white/5 p-1.5 rounded-lg">
                    <p className="text-xs font-medium text-gray-400">Take Profit</p>
                    <p className="text-xs font-semibold text-lime">{profit.primary}</p>
                     <p className="text-xs text-gray-500">{profit.secondary}</p>
                </div>
            </div>
        </div>
    );
};


/**
 * Konten utama modal, sekarang menampilkan DUA rencana.
 */
const AnalysisContent: React.FC<{ result: AnalysisResult, idrRate: number | null, currency: Currency }> = ({ result, idrRate, currency }) => {
    const { bestOption, currentPricePlan, reasoning, isCachedData } = result;

    return (
        <div className="space-y-4 w-full animate-fade-in-content" style={{ animation: 'fade-in-content 0.4s ease-out forwards' }}>
            
            {/* 1. Tampilkan Opsi Terbaik */}
            <PlanDisplay 
                plan={bestOption} 
                title="Opsi Entry Terbaik (Limit)" 
                idrRate={idrRate} 
                currency={currency} 
                isCached={isCachedData} 
            />
            
            {/* Pemisah */}
            <div className="border-t border-dashed border-white/10 my-3"></div>

            {/* 2. Tampilkan Rencana Harga Saat Ini */}
            <PlanDisplay 
                plan={currentPricePlan} 
                title="Opsi Harga Saat Ini (Market)" 
                idrRate={idrRate} 
                currency={currency} 
            />

            {/* 3. Tampilkan Reasoning (HANYA untuk Rencana Harga Saat Ini) */}
            <div>
                 <div className="flex items-center gap-1.5 mb-1">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-electric" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider font-heading">Ulasan (Harga Saat Ini):</h4>
                </div>
                <div className="bg-black/20 border-l-2 border-electric/50 p-2 rounded-r-lg">
                    {/* 'reasoning' sekarang hanya berisi ulasan untuk harga saat ini */}
                    <p className="text-xs text-gray-300 leading-relaxed italic">{reasoning}</p>
                </div>
            </div>
        </div>
    );
};
// --- AKHIR PERUBAHAN ---


const ExchangeLogo = ({ logo, name }: { logo: string, name: string }) => {
  const [imgError, setImgError] = useState(false);
  
  if (imgError || !logo) {
    return (
      <div className="h-4 w-4 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img src={logo} alt={`${name} logo`} className="h-4 w-4 rounded-full flex-shrink-0 bg-white/10" onError={() => setImgError(true)}/>
  );
};

const ExchangePrices: React.FC<{ tickers: ExchangeTicker[], idrRate: number | null, currency: Currency }> = ({ tickers, idrRate, currency }) => (
  <div className="w-full">
    {tickers.length > 0 ? (
      <div className="grid grid-cols-2 gap-1.5">
        {tickers.map(ticker => (
          <a
            key={ticker.name}
            href={ticker.tradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center text-center bg-white/5 p-1.5 rounded-lg hover:bg-electric/20 transition-colors duration-200 group space-y-0.5"
          >
            <div className="flex items-center gap-1">
              <ExchangeLogo logo={ticker.logo} name={ticker.name} />
              <span className="font-medium text-gray-300 text-xs truncate">{ticker.name}</span>
            </div>
            <span className="font-mono text-xs text-gray-50 font-bold">
                {currency === 'idr' && idrRate ? formatIdr(ticker.price * idrRate) : formatUsd(ticker.price)}
            </span>
          </a>
        ))}
      </div>
    ) : <p className="text-gray-500 text-center py-3 text-xs">Tidak ada data bursa ditemukan.</p>}
  </div>
);

const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen, onClose, crypto,
  analysisResult, isLoading, error,
  exchangeTickers, isTickersLoading, tickersError,
  idrRate, currency
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity duration-300 p-1.5 sm:p-3"
      onClick={onClose}
    >
      <div
        className="bg-gray-900/80 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 w-full max-w-2xl transform transition-all duration-300 scale-95 opacity-0 animate-fade-in-scale max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fade-in-scale 0.3s forwards' }}
      >
        <div className="sticky top-0 bg-gray-900/80 backdrop-blur-xl z-10 px-3 py-2 border-b border-white/10">
          <div className="flex justify-between items-center">
            <h2 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2 font-heading">
                <img src={crypto.image} alt={crypto.name} className="h-6 w-6 rounded-full" />
                {crypto.name} <span className='hidden sm:inline text-gray-400 font-sans text-sm'>({crypto.symbol})</span>
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors rounded-full p-0.5 hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-3">
            <div className="grid grid-cols-10 gap-3">
                <div className="col-span-10 lg:col-span-6 space-y-1.5">
                     <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold bg-gradient-to-r from-electric to-magenta text-transparent bg-clip-text inline-block font-heading">Analisis AI</h3>
                        <div className="group relative">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute bottom-full mb-1.5 w-56 bg-gray-800 text-white text-xs rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 -translate-x-1/2 left-1/2">
                                Analisis ini didasarkan pada metodologi multi-indikator canggih yang menggabungkan WaveTrend Oscillator, Divergensi, RSI, dan Money Flow Index (MFI) untuk mengidentifikasi potensi peluang perdagangan.
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-3 border-x-transparent border-t-3 border-t-gray-800"></div>
                            </div>
                        </div>
                    </div>
                     {/* --- PERUBAHAN DISINI --- */}
                     {/* Kontainer ini sekarang akan diisi oleh 'AnalysisContent' yang baru */}
                     <div className="flex items-center justify-center bg-black/20 rounded-lg p-2 min-h-[240px]">
                        {isLoading && <ProfitAnimation />}
                        {error && !isLoading && <ErrorDisplay title="Analisis Gagal" message={error} />}
                        {analysisResult && !isLoading && <AnalysisContent result={analysisResult} idrRate={idrRate} currency={currency} />}
                     </div>
                     {/* --- AKHIR PERUBAHAN --- */}
                </div>

                <div className="col-span-10 lg:col-span-4 space-y-1.5">
                     <h3 className="text-xs font-bold text-gray-200 font-heading">Harga Langsung Bursa ({currency.toUpperCase()})</h3>
                     <div className="bg-black/20 rounded-lg p-1.5">
                        {isTickersLoading && <TickerLoadingSpinner text="Memuat harga..."/>}
                        {tickersError && !isTickersLoading && <div className="p-1.5"><ErrorDisplay title="Gagal Memuat" message={tickersError} /></div>}
                        {!isTickersLoading && !tickersError && <ExchangePrices tickers={exchangeTickers} idrRate={idrRate} currency={currency} />}
                     </div>
                </div>
            </div>
        </div>
        
        <div className="text-center px-3 pb-2 text-xs text-gray-600">
            Selalu lakukan riset Anda sendiri.
        </div>

      </div>
      <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-in-content {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes grow {
            0% { transform: scaleY(0); transform-origin: bottom; }
            50% { transform: scaleY(1); transform-origin: bottom; }
            100% { transform: scaleY(1); transform-origin: bottom; }
        }
        @keyframes float {
            0% { transform: translateY(0) scale(0); opacity: 1; }
            100% { transform: translateY(-60px) scale(1.5); opacity: 0; }
        }
        .animate-grow { animation: grow 1.5s ease-in-out infinite; }
        .animate-float { animation: float 2s ease-out infinite; }
        
        div::-webkit-scrollbar { width: 4px; }
        div::-webkit-scrollbar-track { background: transparent; }
        div::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
        div::-webkit-scrollbar-thumb:hover { background: rgba(0, 191, 255, 0.5); }
      `}</style>
    </div>
  );
};

export default AnalysisModal;