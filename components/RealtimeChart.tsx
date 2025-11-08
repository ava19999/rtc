// components/RealtimeChart.tsx
import React, { useEffect, useRef, memo, useState } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

interface ChartProps {
  symbol: string;
}

async function fetchChartData(symbol: string, interval: string = '4h') {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}USDT&interval=${interval}&limit=500`);
        if (!response.ok) {
            throw new Error('Data chart tidak ditemukan untuk simbol ini');
        }
        const data = await response.json();
        return data.map((d: any) => ({
            time: (d[0] / 1000),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
        }));
    } catch (error) {
        console.error("Gagal mengambil data chart:", error);
        return null;
    }
}

const RealtimeChart: React.FC<ChartProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Pastikan kontainer ada
    if (!chartContainerRef.current) return;
    
    const initializeChart = async () => {
        const chartContainer = chartContainerRef.current;
        if (!chartContainer) {
            console.warn("Kontainer chart hilang saat timeout.");
            setIsLoading(false);
            return;
        }

        // Cek jika chart sudah dibuat untuk simbol yang sama
        if (chartRef.current && seriesRef.current) {
            console.log("Chart sudah ada, memperbarui data...");
            // Update data untuk simbol yang baru
            try {
                const data = await fetchChartData(symbol, '4h');
                if (data && data.length > 0) {
                    seriesRef.current.setData(data);
                    chartRef.current.timeScale().fitContent();
                    console.log("Data chart berhasil di-update.");
                    setIsLoading(false);
                } else {
                    setError(`Data chart 4 jam tidak tersedia untuk ${symbol}USDT`);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Gagal update data chart:", err);
                setError("Gagal memperbarui data chart");
                setIsLoading(false);
            }
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
            
            // 1. Impor library
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
            
            chartRef.current = chart;
            
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
            setIsLoading(false);
            console.log("Loading chart selesai.");
        }
    };

    // Tunggu 350ms untuk memastikan animasi modal selesai
    timeoutRef.current = setTimeout(initializeChart, 350);

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
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        window.removeEventListener('resize', handleWindowResize);
        
        // Hanya hapus chart jika komponen benar-benar di-unmount
        // Bukan ketika simbol berubah
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
        }
    };
  }, [symbol]); // ✅ TAMBAHKAN symbol SEBAGAI DEPENDENCY

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

  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default memo(RealtimeChart);