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
            throw new Error(`HTTP error! status: ${response.status}`);
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
        console.error("Failed to fetch chart data:", error);
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
    if (!chartContainerRef.current) {
        setIsLoading(false);
        return;
    }

    const initializeChart = async () => {
        const chartContainer = chartContainerRef.current;
        if (!chartContainer) {
            setIsLoading(false);
            return;
        }

        const width = chartContainer.clientWidth;
        const height = chartContainer.clientHeight;

        if (width === 0 || height === 0) {
            setError("Gagal memuat chart. Ukuran kontainer tidak valid.");
            setIsLoading(false);
            return;
        }

        try {
            const { createChart, ColorType } = await import('lightweight-charts');
            
            // Clean up existing chart
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
            }

            const chart = createChart(chartContainer, {
                width,
                height,
                layout: {
                    background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
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

            chartRef.current = chart;
            
            const series = chart.addCandlestickSeries({
                upColor: '#32CD32',
                downColor: '#FF00FF',
                borderDownColor: '#FF00FF',
                borderUpColor: '#32CD32',
                wickDownColor: '#FF00FF',
                wickUpColor: '#32CD32',
            });
            seriesRef.current = series;
            
            const data = await fetchChartData(symbol, '4h');
            if (data && data.length > 0) {
                series.setData(data);
                chart.timeScale().fitContent();
            } else {
                throw new Error(`Tidak ada data chart untuk ${symbol}USDT`);
            }

        } catch (err: any) {
            console.error("Chart initialization failed:", err);
            setError(err.message || "Gagal memuat chart");
        } finally {
            setIsLoading(false);
        }
    };

    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(initializeChart, 100);

    const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
            const container = chartContainerRef.current;
            chartRef.current.resize(container.clientWidth, container.clientHeight);
        }
    };

    window.addEventListener('resize', handleResize);

    return () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        window.removeEventListener('resize', handleResize);
        
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
        }
    };
  }, [symbol]);

  if (error) {
      return (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
              <div className="text-magenta text-sm font-semibold mb-2">Error Chart</div>
              <div className="text-gray-400 text-xs text-center">{error}</div>
              <button 
                  onClick={() => {
                      setError(null);
                      setIsLoading(true);
                  }}
                  className="mt-3 px-3 py-1 bg-electric/20 text-electric text-xs rounded hover:bg-electric/30 transition-colors"
              >
                  Coba Lagi
              </button>
          </div>
      );
  }

  if (isLoading) {
     return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-electric"></div>
            <div className="text-gray-400 text-xs">Memuat chart {symbol}...</div>
        </div>
     );
  }

  return (
    <div 
        ref={chartContainerRef} 
        className="w-full h-full"
    />
  );
};

export default memo(RealtimeChart);