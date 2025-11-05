// ava19999/rtc/rtc-09b2646bbe674aaaa08c62f5338b30469b9e2c8d/components/HomePage.tsx
import React, { useState, useCallback, useRef, lazy, Suspense, useEffect } from 'react';
import { fetchCryptoAnalysis } from '../services/geminiService';
import CryptoCard from './CryptoCard';
// --- PERUBAHAN: Impor Currency ---
import type { HomePageProps, MarketDominance, CryptoData, AnalysisResult, ExchangeTicker, CoinListItem, Currency } from '../types';
import HeroCoin from './HeroCoin'; // Kita masih perlu ini untuk carousel
import DominanceTicker from './DominanceTicker';
import {
  fetchMarketDominance,
  fetchExchangeTickers,
} from '../services/mockData';

const AnalysisModal = lazy(() => import('./AnalysisModal'));

const SkeletonHero = () => (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 w-full relative overflow-hidden">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
                <div className="flex items-center mb-3">
                    <div className="h-10 w-10 bg-gray-700 rounded-full mr-3"></div>
                    <div className="flex-1 space-y-1.5">
                        <div className="h-5 w-3/4 bg-gray-700 rounded"></div>
                        <div className="h-3 w-1/4 bg-gray-700 rounded"></div>
                    </div>
                </div>
                <div className="h-8 w-1/2 bg-gray-700 rounded my-1.5"></div>
                <div className="h-16 w-full bg-gray-700 rounded mt-3"></div>
            </div>
            <div className="w-full md:w-1/3 space-y-3">
                <div className="h-7 w-full bg-gray-700 rounded"></div>
                <div className="h-7 w-full bg-gray-700 rounded"></div>
                <div className="h-10 w-full bg-gray-700 rounded mt-3"></div>
            </div>
        </div>
        <div className="absolute top-0 left-0 w-full h-full skeleton-shimmer"></div>
    </div>
);

const SkeletonCard = () => (
  <div className="bg-gray-900 border border-white/10 rounded-xl p-3 h-full w-48 flex-shrink-0 relative overflow-hidden">
    <div className="flex items-center mb-3">
      <div className="h-7 w-7 bg-gray-700 rounded-full mr-2"></div>
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-3/4 bg-gray-700 rounded"></div>
        <div className="h-2.5 w-1/4 bg-gray-700 rounded"></div>
      </div>
    </div>
    <div className="h-8 w-full bg-gray-700 rounded my-1.5"></div>
    <div className="h-5 w-1/2 bg-gray-700 rounded mt-1.5"></div>
    <div className="absolute top-0 left-0 w-full h-full skeleton-shimmer"></div>
  </div>
);


// --- KOMPONEN BARU: HERO COIN CAROUSEL ---
const HeroCoinCarousel: React.FC<{
  coins: CryptoData[];
  onAnalyze: (crypto: CryptoData) => void;
  idrRate: number | null;
  currency: Currency;
}> = ({ coins, onAnalyze, idrRate, currency }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fungsi untuk memulai auto-scroll
  const startAutoScroll = useCallback(() => {
    // Hentikan dulu jika sudah ada
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        // Tentukan lebar item. Asumsikan semua item sama lebar (lebar container)
        // Cek dulu apakah coins.length valid
        if (coins.length === 0) return;
        
        const itemWidth = scrollWidth / coins.length;
        let nextScrollLeft = scrollLeft + itemWidth;

        // Jika scroll berikutnya melebihi batas (dengan toleransi kecil), kembali ke awal
        if (nextScrollLeft + clientWidth > scrollWidth - itemWidth / 2) {
          nextScrollLeft = 0;
        }
        
        scrollRef.current.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
      }
    }, 5000); // Ganti setiap 5 detik
  }, [coins.length]);

  // Fungsi untuk menghentikan auto-scroll
  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Mulai auto-scroll saat komponen dimuat
  useEffect(() => {
    startAutoScroll();
    // Hentikan interval saat komponen di-unmount
    return () => stopAutoScroll();
  }, [startAutoScroll]);

  // Handle interaksi manual (mousedown dan touchstart)
  // Dikelola via useEffect untuk cleanup yang lebih baik
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let interactionTimeout: NodeJS.Timeout | null = null;

    const handleManualInteraction = () => {
      stopAutoScroll(); // Hentikan auto-scroll
      
      // Hapus timeout sebelumnya jika ada
      if (interactionTimeout) {
        clearTimeout(interactionTimeout);
      }
      
      // Mulai lagi auto-scroll setelah 10 detik tidak aktif
      interactionTimeout = setTimeout(() => {
        startAutoScroll();
      }, 10000); 
    };

    el.addEventListener('mousedown', handleManualInteraction);
    el.addEventListener('touchstart', handleManualInteraction, { passive: true });
    
    return () => {
      el.removeEventListener('mousedown', handleManualInteraction);
      el.removeEventListener('touchstart', handleManualInteraction);
      if (interactionTimeout) {
        clearTimeout(interactionTimeout); // Bersihkan timeout saat unmount
      }
    };
  }, [startAutoScroll]); // Dependensi ke startAutoScroll

  return (
    <div className="relative w-full">
      <div 
        ref={scrollRef} 
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth custom-scrollbar"
        style={{ scrollbarWidth: 'none' }} // Sembunyikan scrollbar di Firefox
      >
        {coins.map((coin) => (
          <div key={coin.id} className="flex-shrink-0 w-full snap-center">
            {/* Menggunakan kembali komponen HeroCoin untuk setiap item */}
            <HeroCoin crypto={coin} onAnalyze={onAnalyze} idrRate={idrRate} currency={currency} />
          </div>
        ))}
      </div>
      {/* Indikator Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
        {coins.map((coin) => (
          <div key={`${coin.id}-dot`} className="w-1.5 h-1.5 bg-white/30 rounded-full" />
        ))}
      </div>
    </div>
  );
};
// --- AKHIR KOMPONEN BARU ---


const HomePage: React.FC<HomePageProps> = ({ 
    idrRate, isRateLoading, currency, onIncrementAnalysisCount, 
    fullCoinList, isCoinListLoading, coinListError,
    // --- PROPS BARU DITERIMA ---
    heroCoin, // Ini adalah trending[0]
    otherTrendingCoins, 
    isTrendingLoading, 
    trendingError, 
    staticHeroCoins, // Ini adalah [BTC, ETH, SOL]
    isStaticHeroLoading,
    staticHeroError,
    // --- AKHIR PROPS BARU ---
    onSelectCoin, onReloadTrending
}) => {
  const [marketDominance, setMarketDominance] = useState<MarketDominance | null>(null);
  const [isDominanceLoading, setIsDominanceLoading] = useState(true);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoData | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [exchangeTickers, setExchangeTickers] = useState<ExchangeTicker[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isTickersLoading, setIsTickersLoading] = useState(false);
  const [tickersError, setTickersError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCoinList, setFilteredCoinList] = useState<CoinListItem[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const fetchDominanceData = useCallback(async () => {
    setIsDominanceLoading(true);
    try {
        const dominance = await fetchMarketDominance();
        setMarketDominance(dominance);
    } catch(err) {
        console.error("Gagal memuat data dominasi:", err);
    } finally {
        setIsDominanceLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchDominanceData();
  }, [fetchDominanceData]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      const lowercasedQuery = searchQuery.toLowerCase();
      const filtered = fullCoinList
        .filter(coin => coin.name.toLowerCase().includes(lowercasedQuery) || coin.symbol.toLowerCase().includes(lowercasedQuery))
        .slice(0, 7);
      setFilteredCoinList(filtered);
    } else { setFilteredCoinList([]); }
  }, [searchQuery, fullCoinList]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setFilteredCoinList([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSelect = useCallback(async (coinId: string) => {
    setSearchQuery('');
    setFilteredCoinList([]);
    onSelectCoin(coinId);
  }, [onSelectCoin]);

  const handleAnalyze = useCallback(async (crypto: CryptoData) => {
    onIncrementAnalysisCount(crypto.id);
    setSelectedCrypto(crypto); setIsModalOpen(true);
    setIsAnalysisLoading(true); setAnalysisError(null); setAnalysisResult(null);
    setIsTickersLoading(true); setTickersError(null); setExchangeTickers([]);

    fetchCryptoAnalysis(crypto.name, crypto.price)
      .then(setAnalysisResult)
      .catch(err => setAnalysisError(err.message))
      .finally(() => setIsAnalysisLoading(false));
    
    fetchExchangeTickers(crypto.id)
      .then(setExchangeTickers)
      .catch(err => setTickersError(err.message))
      .finally(() => setIsTickersLoading(false));
  }, [onIncrementAnalysisCount]);

  const closeModal = () => { setIsModalOpen(false); setSelectedCrypto(null); };
  
  const renderContent = () => {
    // --- PERUBAHAN: Cek kedua loading state ---
    if (isTrendingLoading || isStaticHeroLoading) {
      return (
        <>
          <SkeletonHero />
          <div className="flex space-x-3 overflow-x-auto pb-3 -mx-3 px-3 custom-scrollbar mt-4">
            {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)}
          </div>
        </>
      );
    }
    
    // --- PERUBAHAN: Cek kedua error state ---
    const combinedError = trendingError || staticHeroError;
    if (combinedError) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-magenta mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-base font-semibold text-red-400">Tidak Dapat Memuat Data</p>
            {/* Tampilkan pesan error gabungan */}
            <p className="text-gray-400 mt-1.5 mb-3 max-w-md text-sm">{combinedError}</p>
            <button onClick={onReloadTrending} className="bg-electric/80 hover:bg-electric text-white font-semibold py-1.5 px-4 rounded-lg transition-all duration-300 text-sm">Coba Lagi</button>
        </div>
      );
    }

    return (
      <div className="animate-fade-in-content">
        {/* --- PERUBAHAN: Gunakan Carousel baru --- */}
        {staticHeroCoins.length > 0 && (
          <HeroCoinCarousel 
            coins={staticHeroCoins} 
            onAnalyze={handleAnalyze} 
            idrRate={idrRate} 
            currency={currency} 
          />
        )}
        
        {/* --- PERUBAHAN: Tampilkan SEMUA trending coins di "Peluang Pasar Lainnya" --- */}
        {(heroCoin || otherTrendingCoins.length > 0) && (
          <div className="mt-4">
             <h3 className="text-base font-bold text-gray-300 mb-2">Peluang Pasar Lainnya</h3>
             <div className="flex space-x-3 overflow-x-auto pb-3 -mx-3 px-3 custom-scrollbar">
                {/* Tampilkan heroCoin (trending[0]) sebagai card pertama */}
                {heroCoin && <CryptoCard key={heroCoin.id} crypto={heroCoin} onAnalyze={handleAnalyze} idrRate={idrRate} currency={currency} />}
                {/* Tampilkan sisanya */}
                {otherTrendingCoins.map(crypto => <CryptoCard key={crypto.id} crypto={crypto} onAnalyze={handleAnalyze} idrRate={idrRate} currency={currency} />)}
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 pt-3 pb-4">
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-3">
                 <div className="text-center md:text-left">
                    <h2 className="text-xl font-black text-gray-100 font-heading">Cari <span className="bg-gradient-to-r from-electric to-magenta text-transparent bg-clip-text">Cuan</span> Lo Selanjutnya</h2>
                    <p className="text-gray-400 text-xs mt-0.5">Data paling gacor hari ini, dianalisis pake AI.</p>
                </div>
                 <div className="relative w-full sm:max-w-xs" ref={searchContainerRef}>
                    <input type="text" placeholder="Cari 500 koin teratas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-9 pr-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-electric transition-all text-sm" />
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {(searchQuery.length > 0) && (
                        <ul className="absolute top-full mt-1.5 w-full bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-lg shadow-lg max-h-64 overflow-y-auto z-30">
                          {isCoinListLoading ? (
                            <li className="px-3 py-2 text-xs text-gray-400 text-center">Memuat daftar koin...</li>
                          ) : coinListError ? (
                            <li className="px-3 py-2 text-xs text-red-400 text-center">{coinListError}</li>
                          ) : filteredCoinList.length > 0 ? (
                            filteredCoinList.map(coin => (
                              <li key={coin.id} onClick={() => handleSearchSelect(coin.id)} className="flex items-center gap-2 px-3 py-2 hover:bg-electric/20 cursor-pointer text-xs font-medium transition-colors">
                                  <img src={coin.image} alt={coin.name} className="h-5 w-5 rounded-full" loading="lazy" />
                                  <span>{coin.name} <span className="text-gray-400">{coin.symbol.toUpperCase()}</span></span>
                              </li>
                            ))
                          ) : (
                             <li className="px-3 py-2 text-xs text-gray-400 text-center">Tidak ada koin ditemukan.</li>
                          )}
                        </ul>
                    )}
                </div>
            </div>
            
            <DominanceTicker initialData={marketDominance} isLoading={isDominanceLoading} />

            {renderContent()}
        </div>
        {isModalOpen && selectedCrypto && (
          <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-40" />}>
            <AnalysisModal isOpen={isModalOpen} onClose={closeModal} crypto={selectedCrypto} analysisResult={analysisResult} isLoading={isAnalysisLoading} error={analysisError} exchangeTickers={exchangeTickers} isTickersLoading={isTickersLoading} tickersError={tickersError} idrRate={idrRate} currency={currency} />
          </Suspense>
        )}
        <style>{`
            @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes fade-in-content { from { opacity: 0; } to { opacity: 1; } }
            .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
            .animate-fade-in-content { animation: fade-in-content 0.5s 0.15s ease-out forwards; opacity: 0; }
            .custom-scrollbar::-webkit-scrollbar { height: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 191, 255, 0.5); }
            /* Sembunyikan scrollbar untuk carousel */
            .custom-scrollbar {
              -ms-overflow-style: none;  /* IE and Edge */
              scrollbar-width: none;  /* Firefox */
            }
            .custom-scrollbar::-webkit-scrollbar {
              display: none; /* Chrome, Safari, Opera */
            }
        `}</style>
    </div>
  );
};

export default HomePage;