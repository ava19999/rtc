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
  const [isLoading, setIsLoading] = useState(true); // Selalu mulai dengan loading

  useEffect(() => {
    // Pastikan kontainer ada
    if (!chartContainerRef.current) return;
    
    // --- PERBAIKAN UTAMA: setTimeout 350ms ---
    // Animasi modal induk adalah 300ms (0.3s).
    // Kita tunggu 350ms untuk MEMASTIKAN animasi selesai
    // dan div kontainer memiliki lebar (clientWidth) yang valid.
    const chartTimeout = setTimeout(async () => {
        const chartContainer = chartContainerRef.current;
        if (!chartContainer) {
            console.warn("Kontainer chart hilang saat timeout.");
            setIsLoading(false);
            return;
        }

        // Cek jika chart sudah dibuat
        if (chartRef.current) {
            console.log("Chart sudah ada, tidak membuat lagi.");
            setIsLoading(false);
            return;
        }

        const width = chartContainer.clientWidth;
        const height = chartContainer.clientHeight;

        // Penjaga: Pastikan kontainer memiliki ukuran
        if (width === 0 || height === 0) {
            console.error(`Gagal membuat chart: Ukuran kontainer tidak valid (W: ${width}, H: ${height})`);
            setError("Gagal memuat chart. Coba buka-tutup modal.");
            setIsLoading(false);
            return;
        }
        
        try {
            console.log(`Kontainer siap (W: ${width}, H: ${height}). Mengimpor library chart...`);
            
            // 1. Impor library HANYA SETELAH container siap
            const { createChart, ColorType } = await import('lightweight-charts');
            console.log("Library chart berhasil diimpor. Membuat chart...");

            // 2. Buat chart
            const chart = createChart(chartContainer, {
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

            if (!chart || typeof chart.addCandlestickSeries !== 'function') {
                 throw new Error("createChart gagal mengembalikan objek yang valid.");
            }
            
            chartRef.current = chart; // Simpan ref
            
            // 3. Tambahkan series
            const series = chart.addCandlestickSeries({
                upColor: '#32CD32',
                downColor: '#FF00FF',
                borderDownColor: '#FF00FF',
                borderUpColor: '#32CD32',
                wickDownColor: '#FF00FF',
                wickUpColor: '#32CD32',
            });
            seriesRef.current = series;
            console.log("Series candlestick ditambahkan.");

            // 4. Ambil data
            console.log(`Mengambil data untuk ${symbol}USDT...`);
            const data = await fetchChartData(symbol, '4h');
            if (data && data.length > 0) {
                series.setData(data);
                chart.timeScale().fitContent();
                console.log("Data chart berhasil di-set.");
            } else {
                setError(`Data chart 4 jam tidak tersedia untuk ${symbol}USDT`);
            }

        } catch (err: any) {
            console.error("Gagal saat inisialisasi chart:", err);
            setError(err.message || "Gagal menginisialisasi chart. Coba lagi.");
        } finally {
            // 5. Selesai (baik sukses atau gagal)
            setIsLoading(false);
            console.log("Loading chart selesai.");
        }
    }, 350); // Timeout 350ms
    // --- AKHIR PERBAIKAN ---

    // Handle resize window
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
        clearTimeout(chartTimeout); // Wajib!
        window.removeEventListener('resize', handleWindowResize);
        chartRef.current?.remove();
        chartRef.current = null;
    };
  }, []); // Array kosong, agar berjalan setiap kali di-mount

  if (error) {
      return (
          <div className="w-full h-full flex items-center justify-center text-center text-magenta text-xs p-4">
              {error}
          </div>
      );
  }
  
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