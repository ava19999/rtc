// components/RealtimeChart.tsx
import React, { useEffect, useRef, memo, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';

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

  useEffect(() => {
    // --- PERBAIKAN DI SINI ---
    // Kita gunakan setTimeout 50ms. Ini menunda eksekusi
    // hingga React selesai me-render ulang dan browser
    // telah menghitung ukuran container h-[300px] yang baru.
    const chartTimeout = setTimeout(() => {
        if (!chartContainerRef.current) return;

        // Cek jika chart sudah ada, jangan buat lagi
        if (chartRef.current) return;

        const containerWidth = chartContainerRef.current.clientWidth;
        const containerHeight = chartContainerRef.current.clientHeight;

        // Penjaga: Pastikan kontainer memiliki lebar dan tinggi
        if (containerWidth === 0 || containerHeight === 0) {
            console.warn(`Ukuran kontainer tidak valid (W: ${containerWidth}, H: ${containerHeight}). Membatalkan render.`);
            setError("Gagal memuat chart. Coba buka-tutup modal.");
            return;
        }

        // Buat chart
        chartRef.current = createChart(chartContainerRef.current, {
            width: containerWidth,
            height: containerHeight, // Gunakan tinggi dari kontainer
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#D1D5DB', // Teks abu-abu
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

        // Tambahkan seri candlestick
        seriesRef.current = chartRef.current.addCandlestickSeries({
            upColor: '#32CD32', // Warna lime
            downColor: '#FF00FF', // Warna magenta
            borderDownColor: '#FF00FF',
            borderUpColor: '#32CD32',
            wickDownColor: '#FF00FF',
            wickUpColor: '#32CD32',
        });

        // Ambil data saat komponen dimuat
        fetchChartData(symbol, '4h').then(data => {
            if (data && data.length > 0) {
                seriesRef.current?.setData(data);
                chartRef.current?.timeScale().fitContent();
            } else {
                setError(`Data chart 4 jam tidak tersedia untuk ${symbol}USDT`);
            }
        });
    }, 50); // Timeout 50ms (lebih cepat dari 100ms, tapi cukup)
    // --- AKHIR PERBAIKAN ---

    // Handle resize
    const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
             // Sesuaikan ukuran chart jika window di-resize
             chartRef.current.resize(
                chartContainerRef.current.clientWidth, 
                chartContainerRef.current.clientHeight
             );
        }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
        clearTimeout(chartTimeout); // Hapus timeout jika komponen unmount
        window.removeEventListener('resize', handleResize);
        chartRef.current?.remove();
        chartRef.current = null; // Reset ref
    };
  }, [symbol]); // Tetap jalankan hanya saat simbol berubah

  if (error) {
      return (
          <div className="w-full h-full flex items-center justify-center text-center text-magenta text-xs p-4">
              {error}
          </div>
      );
  }

  // --- PERUBAHAN DI SINI: Ubah h-[300px] menjadi h-full ---
  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default memo(RealtimeChart);