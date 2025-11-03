// CryptoCard.tsx
import React from 'react';
import type { CryptoCardProps } from '../types';

const Sparkline = ({ data, color }: { data: number[], color: string }) => {
  if (!data || data.length < 2) {
    return <div className="h-8 w-full flex items-center justify-center text-xs text-gray-500">Data tidak cukup</div>;
  }

  const width = 100;
  const height = 32;
  const strokeWidth = 1.2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d - min) / range) * (height - strokeWidth * 2) - strokeWidth;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="relative w-full h-8">
       <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
};

const formatUsd = (price: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 18,
  }).format(price);
};

const formatIdr = (value: number, rate: number | null) => {
    if (value === null || rate === null) return '...';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value * rate);
};

const CryptoCard: React.FC<CryptoCardProps> = ({ crypto, onAnalyze, idrRate, currency }) => {
  const isPositive = crypto.change >= 0;

  return (
    <div className="group relative rounded-lg overflow-hidden bg-gray-900 border border-white/10 w-48 flex-shrink-0 flex flex-col transition-all duration-300 hover:-translate-y-0.5">
      <div 
        className="absolute -inset-px rounded-lg bg-gradient-to-r from-lime via-magenta to-electric opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        aria-hidden="true"
      ></div>
      <div className="relative bg-gray-900/95 rounded-lg p-2.5 flex flex-col justify-between h-full z-10">
        <div>
          <div className="flex items-center mb-1.5">
             <img src={crypto.image} alt={crypto.name} className="h-7 w-7 rounded-full mr-2" loading="lazy" decoding="async" />
             <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-100 truncate">{crypto.name}</h3>
                <span className="text-xs text-gray-400 font-mono">{crypto.symbol}</span>
             </div>
          </div>

          <Sparkline data={crypto.sparkline_in_7d.price} color={isPositive ? '#32CD32' : '#FF00FF'} />
          
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-base font-semibold text-gray-50 tracking-tight">
              {currency === 'idr' && idrRate ? formatIdr(crypto.price, idrRate) : formatUsd(crypto.price)}
            </p>
            <div className={`inline-flex items-center text-xs font-medium ${isPositive ? 'text-lime' : 'text-magenta'}`}>
              {isPositive ? '▲' : '▼'} {crypto.change.toFixed(2)}%
            </div>
          </div>
        </div>
        <button
          onClick={() => onAnalyze(crypto)}
          className="mt-2 w-full bg-white/5 border border-white/10 hover:border-electric hover:bg-electric/20 hover:text-electric text-white font-semibold py-1.5 px-3 rounded-lg transition-all duration-300 focus:outline-none focus:ring-1.5 focus:ring-offset-1 focus:ring-offset-gray-900 focus:ring-electric text-xs"
        >
          Analisis AI
        </button>
      </div>
    </div>
  );
};

export default CryptoCard;