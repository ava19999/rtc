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
    // Pastikan kontainer ada
    if (!chartContainerRef.current) return;
    
    // --- PERBAIKAN: Menggunakan ResizeObserver ---
    // Ini adalah cara paling handal untuk menunggu
    // container <div> memiliki ukuran yang valid (bukan 0).
    
    const chartContainer = chartContainerRef.current;

    const resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0];
        if (!entry) return;

        const { width, height } = entry.contentRect;

        // Cek jika sudah memiliki ukuran (lebih besar dari 0)
        // DAN chart belum pernah dibuat (chartRef.current masih null)
        if (width > 0 && height > 0 && !chartRef.current) {
            console.log(`Kontainer siap (W: ${width}, H: ${height}). Membuat chart.`);
            
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

            // Cek lagi apakah createChart berhasil
            if (chart && typeof chart.addCandlestickSeries === 'function') {
                chartRef.current = chart; // Simpan ref
                
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
                
                // Setelah chart berhasil dibuat, kita tidak perlu mengamati lagi
                resizeObserver.disconnect();

            } else {
                console.error("Gagal membuat chart, objek tidak valid.", chart);
                setError("Gagal menginisialisasi chart. Coba lagi.");
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

  // h-full akan mengambil tinggi dari parent-nya (yaitu h-[300px] di AnalysisModal)
  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default memo(RealtimeChart);