import React, { useEffect, useRef, memo, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType } from 'lightweight-charts';

interface ChartProps {
  symbol: string;
}

async function fetchChartData(symbol: string, interval: string = '4h') {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}USDT&interval=${interval}&limit=500`);
    if (!response.ok) throw new Error('Data chart tidak ditemukan');
    const data = await response.json();
    return data.map((d: any) => ({
      time: d[0] / 1000,
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      const container = chartContainerRef.current;
      if (!container) {
        setError("Kontainer chart tidak ditemukan.");
        return;
      }

      if (chartRef.current) return;

      const width = container.clientWidth || 300;
      const height = container.clientHeight || 200;

      if (width === 0 || height === 0) {
        setError("Ukuran kontainer tidak valid. Coba buka-tutup modal.");
        return;
      }

      try {
        const chart = createChart(container, {
          width,
          height,
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#D1D5DB',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.1)' },
            horzLines: { color: 'rgba(255,255,255,0.1)' },
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.2)',
            timeVisible: true,
          },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.2)',
          },
        });

        if (!chart || typeof chart.addCandlestickSeries !== 'function') {
          throw new Error("createChart tidak mengembalikan objek yang valid.");
        }

        chartRef.current = chart;
        seriesRef.current = chart.addCandlestickSeries({
          upColor: '#32CD32',
          downColor: '#FF00FF',
          borderUpColor: '#32CD32',
          borderDownColor: '#FF00FF',
          wickUpColor: '#32CD32',
          wickDownColor: '#FF00FF',
        });

        fetchChartData(symbol).then(data => {
          if (data && data.length > 0) {
            seriesRef.current?.setData(data);
            chartRef.current?.timeScale().fitContent();
          } else {
            setError(`Data chart tidak tersedia untuk ${symbol}USDT`);
          }
        });
      } catch (err) {
        console.error(err);
        setError("Gagal menginisialisasi chart.");
      }
    }, 350);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.resize(
          chartContainerRef.current.clientWidth,
          chartContainerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [symbol]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-center text-magenta text-xs p-4">
        {error}
      </div>
    );
  }

  return <div ref={chartContainerRef} className="w-full h-full" />;
};

export default memo(RealtimeChart);
