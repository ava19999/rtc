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
    // Animasi fade-in modal induknya adalah 300ms.
    // Kita harus menunggu animasi itu selesai sebelum 
    // kontainer ini memiliki lebar (clientWidth) yang valid.
    // Kita set 350ms agar aman.
    const chartTimeout = setTimeout(() => {
        if (!chartContainerRef.current) {
            console.log("Kontainer chart hilang saat timeout, membatalkan.");
            return;
        }

        // Cek jika chart sudah ada, jangan buat lagi
        if (chartRef.current) {
            console.log("Chart sudah ada, tidak membuat lagi.");
            return;
        }
        
        const containerWidth = chartContainerRef.current.clientWidth;
        const containerHeight = chartContainerRef.current.clientHeight;

        // Penjaga: Pastikan kontainer memiliki ukuran yang valid
        if (containerWidth === 0 || containerHeight === 0) {
            console.warn(`Ukuran kontainer tidak valid setelah timeout (W: ${containerWidth}, H: ${containerHeight}). Membatalkan render.`);
            setError("Gagal memuat chart. Coba buka-tutup modal.");
            return;
        }

        // Buat chart
        const chart = createChart(chartContainerRef.current, {
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

        // Penjaga: Cek apakah createChart mengembalikan objek yang valid
        if (chart && typeof chart.addCandlestickSeries === 'function') {
            chartRef.current = chart; // Simpan ref

            // Tambahkan seri candlestick
            seriesRef.current = chart.addCandlestickSeries({
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
        } else {
             console.error("createChart gagal mengembalikan objek yang valid.");
             setError("Gagal menginisialisasi chart. Coba lagi.");
        }
        
    }, 350); // Timeout diubah ke 350ms
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

  // Gunakan h-full agar pas dengan kontainer h-[300px] di AnalysisModal
  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default memo(RealtimeChart);