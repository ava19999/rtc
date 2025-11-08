// components/RealtimeChart.tsx
import React, { useEffect, useRef, memo, useState } from 'react';

interface ChartProps {
  symbol: string;
}

// Simple fallback chart component
const SimpleChartFallback = ({ symbol }: { symbol: string }) => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded-lg p-4">
      <div className="text-electric text-sm font-semibold mb-2">Chart: {symbol}/USDT</div>
      <div className="text-gray-400 text-xs text-center">
        Chart untuk {symbol} akan ditampilkan di sini.
        <br />
        Data dari Binance API.
      </div>
    </div>
  );
};

const RealtimeChart: React.FC<ChartProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartLoaded, setChartLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    let chart: any = null;
    let series: any = null;

    const initializeChart = async () => {
      if (!mounted || !chartContainerRef.current) return;

      try {
        console.log(`🔄 Initializing chart for ${symbol}`);
        
        const container = chartContainerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (width === 0 || height === 0) {
          console.warn('Container has zero dimensions');
          // Try again after a short delay
          setTimeout(() => {
            if (mounted) initializeChart();
          }, 100);
          return;
        }

        // Dynamic import of lightweight-charts
        const { createChart } = await import('lightweight-charts');
        
        // Create chart
        chart = createChart(container, {
          width,
          height,
          layout: {
            background: { color: 'transparent' },
            textColor: '#D1D5DB',
          },
          grid: {
            vertLines: { color: 'rgba(255, 255, 255, 0.1)' },
            horzLines: { color: 'rgba(255, 255, 255, 0.1)' },
          },
          timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.2)',
            timeVisible: true,
          },
        });

        // Add candlestick series
        series = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          borderVisible: false,
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
        });

        // Mock data for testing - in production, replace with real API call
        const mockData = [
          { time: '2023-01-01', open: 100, high: 110, low: 95, close: 105 },
          { time: '2023-01-02', open: 105, high: 115, low: 100, close: 110 },
          { time: '2023-01-03', open: 110, high: 120, low: 105, close: 115 },
          { time: '2023-01-04', open: 115, high: 125, low: 110, close: 120 },
          { time: '2023-01-05', open: 120, high: 130, low: 115, close: 125 },
        ];

        series.setData(mockData);
        
        // Fit content to view
        chart.timeScale().fitContent();

        // Handle resize
        const handleResize = () => {
          if (chart && container) {
            chart.applyOptions({
              width: container.clientWidth,
              height: container.clientHeight,
            });
          }
        };

        window.addEventListener('resize', handleResize);

        if (mounted) {
          setChartLoaded(true);
          setIsLoading(false);
          console.log('✅ Chart loaded successfully');
        }

        // Cleanup resize listener on unmount
        return () => {
          window.removeEventListener('resize', handleResize);
        };

      } catch (err) {
        console.error('❌ Chart initialization failed:', err);
        if (mounted) {
          setError('Failed to load chart: ' + (err as Error).message);
          setIsLoading(false);
        }
      }
    };

    // Start initialization
    const timer = setTimeout(initializeChart, 50);

    // Cleanup function
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (chart) {
        try {
          chart.remove();
        } catch (e) {
          console.warn('Error removing chart:', e);
        }
      }
    };
  }, [symbol]);

  // Show error state
  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="text-magenta text-sm font-semibold mb-2">Chart Error</div>
        <div className="text-gray-400 text-xs text-center mb-3">{error}</div>
        <SimpleChartFallback symbol={symbol} />
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-electric"></div>
        <div className="text-gray-400 text-xs text-center">
          Loading chart for {symbol}...
        </div>
      </div>
    );
  }

  // Show chart container
  return (
    <div className="w-full h-full relative">
      <div 
        ref={chartContainerRef} 
        className="w-full h-full"
      />
      {chartLoaded && (
        <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-electric">
          {symbol}/USDT
        </div>
      )}
    </div>
  );
};

export default memo(RealtimeChart);