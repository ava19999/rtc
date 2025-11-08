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
    if (!chartContainerRef.current) return;

    // --- PERBAIKAN DI SINI ---
    // Kita gunakan setTimeout untuk menunda eksekusi hingga DOM stabil.
    // Ini memperbaiki bug "layar putih" di mana chart mencoba render
    // sebelum container-nya memiliki lebar (width).
    const chartTimeout = setTimeout(() => {
        if (!chartContainerRef.current) return;

        // Cek jika chart sudah ada, jangan buat lagi
        if (chartRef.current) return;

        // Buat chart
        chartRef.current = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 300, // Atur tinggi chart
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
    }, 0); // Timeout 0 detik sudah cukup

    // Handle resize
    const handleResize = () => {
        if (chartContainerRef.current) {
             chartRef.current?.resize(chartContainerRef.current.clientWidth, 300);
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
          <div className="w-full h-[300px] flex items-center justify-center text-center text-magenta text-xs p-4">
              {error}
          </div>
      );
  }

  return <div ref={chartContainerRef} className="w-full h-[300px]" />;
};

export default memo(RealtimeChart);