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
    // Animasi fade-in modal adalah 400ms.
    // Kita set timeout ke 450ms untuk memastikan animasi selesai
    // dan div container memiliki lebar (clientWidth) yang valid.
    const chartTimeout = setTimeout(() => {
        if (!chartContainerRef.current) {
            console.warn("Chart container ref hilang, membatalkan.");
            return;
        }

        const containerWidth = chartContainerRef.current.clientWidth;
        if (containerWidth === 0) {
            console.warn("Lebar kontainer chart 0. Membatalkan render.");
            setError("Gagal memuat chart. Coba buka-tutup modal.");
            return;
        }

        if (chartRef.current) {
            console.log("Chart sudah ada, tidak membuat lagi.");
            return;
        }

        // Buat chart
        const chart = createChart(chartContainerRef.current, {
            width: containerWidth,
            height: 300, 
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

        // Cek apakah objek chart valid
        if (chart && typeof chart.addCandlestickSeries === 'function') {
            chartRef.current = chart; 
            
            seriesRef.current = chart.addCandlestickSeries({
                upColor: '#32CD32',
                downColor: '#FF00FF',
                borderDownColor: '#FF00FF',
                borderUpColor: '#32CD32',
                wickDownColor: '#FF00FF',
                wickUpColor: '#32CD32',
            });

            // Ambil data
            fetchChartData(symbol, '4h').then(data => {
                if (data && data.length > 0) {
                    seriesRef.current?.setData(data);
                    chartRef.current?.timeScale().fitContent();
                } else {
                    setError(`Data chart 4 jam tidak tersedia untuk ${symbol}USDT`);
                }
            });
        } else {
            console.error("Gagal membuat chart, objek tidak valid.", chart);
            setError("Gagal menginisialisasi chart. Coba lagi.");
        }
        
    }, 450); // Diubah ke 450ms untuk menunggu animasi selesai
    // --- AKHIR PERBAIKAN ---

    // Handle resize
    const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
             chartRef.current.resize(chartContainerRef.current.clientWidth, 300);
        }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
        clearTimeout(chartTimeout); 
        window.removeEventListener('resize', handleResize);
        chartRef.current?.remove();
        chartRef.current = null; // Reset ref
    };
  }, [symbol]); 

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