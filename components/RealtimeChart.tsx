// components/RealtimeChart.tsx
import React, { useEffect, useRef, memo, useState } from 'react';
// --- PERUBAHAN DI SINI ---
// Kita hanya mengimpor TIPE, bukan fungsi `createChart`
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
// --- AKHIR PERUBAHAN ---

interface ChartProps {
  symbol: string; // Misal: "BTC"
}

// Fungsi untuk mengambil & memformat data dari API Binance
async function fetchChartData(symbol: string, interval: string = '4h') {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}USDT&interval=${interval}&limit=500`);
        if (!response.ok) {
            throw new Error('Data chart tidak ditemukan untuk simbol ini');
        }
        const data = await response.json();

        // Format data agar sesuai dengan Lightweight Charts
        // Data Binance: [time, open, high, low, close, ...]
        return data.map((d: any) => ({
            time: (d[0] / 1000) as number, // Konversi milidetik ke detik
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
        }));
    } catch (error) {
        console.error("Gagal mengambil data chart:", error);
        return null; // Kembalikan null jika gagal
    }
}

const RealtimeChart: React.FC<ChartProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Tambahkan state loading

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    let chart: IChartApi | null = null;
    const chartContainer = chartContainerRef.current;

    const resizeObserver = new ResizeObserver(async (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const { width, height } = entry.contentRect;

        // Cek jika ukuran valid DAN chart belum dibuat
        if (width > 0 && height > 0 && !chartRef.current) {
            // Kita hanya ingin ini berjalan SEKALI.
            resizeObserver.disconnect();
            
            try {
                // --- PERUBAHAN UTAMA: DYNAMIC IMPORT ---
                // Impor library HANYA SETELAH container siap
                const { createChart, ColorType } = await import('lightweight-charts');
                // --- AKHIR PERUBAHAN ---

                chart = createChart(chartContainer, {
                    width,
                    height,
                    layout: {
                        background: { type: ColorType.Solid, color: 'transparent' },
                        textColor: '#D1D5DB',
                    },
                    grid: {
                        vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    },
                    timeScale: {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        timeVisible: true,
                        secondsVisible: false,
                    },
                    rightPriceScale: {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                });
                
                // Cek apakah createChart berhasil
                if (chart && typeof chart.addCandlestickSeries === 'function') {
                    chartRef.current = chart; // Simpan ref
                    
                    const series = chart.addCandlestickSeries({
                        upColor: '#32CD32',
                        downColor: '#FF00FF',
                        borderDownColor: '#FF00FF',
                        borderUpColor: '#32CD32',
                        wickDownColor: '#FF00FF',
                        wickUpColor: '#32CD32',
                    });
                    seriesRef.current = series;

                    // Ambil data
                    const data = await fetchChartData(symbol, '4h');
                    if (data && data.length > 0) {
                        series.setData(data);
                        chart.timeScale().fitContent();
                        setIsLoading(false); // Sembunyikan loading
                    } else {
                        setError(`Data chart 4 jam tidak tersedia untuk ${symbol}USDT`);
                        setIsLoading(false);
                    }
                } else {
                    // Ini seharusnya tidak terjadi lagi, tapi sebagai penjaga
                    throw new Error("createChart gagal mengembalikan objek yang valid.");
                }
            } catch (err: any) {
                console.error("Gagal saat inisialisasi chart:", err);
                setError(err.message || "Gagal menginisialisasi chart. Coba lagi.");
                setIsLoading(false);
            }
        }
    });

    // Mulai amati kontainer
    resizeObserver.observe(chartContainer);

    // Handle resize window (terpisah dari setup awal)
    const handleWindowResize = () => {
        if (chartRef.current && chartContainerRef.current) {
             chartRef.current.resize(
                chartContainerRef.current.clientWidth, 
                chartContainerRef.current.clientHeight
             );
        }
    };
    window.addEventListener('resize', handleWindowResize);

    // Cleanup
    return () => {
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleWindowResize);
        chartRef.current?.remove();
        chartRef.current = null;
    };
  }, [symbol]); // Tetap jalankan hanya saat simbol berubah

  if (error) {
      return (
          <div className="w-full h-full flex items-center justify-center text-center text-magenta text-xs p-4">
              {error}
          </div>
      );
  }
  
  // Tampilkan loading spinner saat chart/data sedang disiapkan
  if (isLoading) {
     return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-1.5">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-electric/50"></div>
            <p className="text-gray-400 text-xs">Memuat data chart...</p>
        </div>
     );
  }

  // h-full akan mengambil tinggi dari parent-nya (yaitu h-[300px] di AnalysisModal)
  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default memo(RealtimeChart);