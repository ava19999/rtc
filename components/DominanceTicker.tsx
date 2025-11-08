// DominanceTicker.tsx
import React from 'react';
import type { MarketDominance } from '../types';

const TickerItemSkeleton = () => (
    <div className="flex-1 bg-gray-800/50 p-2 rounded-lg animate-pulse">
        <div className="h-3.5 w-2/3 bg-gray-700 rounded mb-1.5 mx-auto"></div>
        <div className="h-5 w-1/3 bg-gray-700 rounded mx-auto"></div>
    </div>
);

const TickerItem = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => {
    return (
        <div className="flex-1 text-center px-2 py-1">
            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <div className={`text-base font-bold ${colorClass}`}>
                <span>{value.toFixed(2)}%</span>
            </div>
        </div>
    );
};

const DominanceTicker = ({ initialData, isLoading }: { initialData: MarketDominance | null; isLoading: boolean }) => {
    if (isLoading) {
        return (
            <div className="flex items-center gap-3 bg-gray-900/50 border border-white/10 rounded-xl p-0.5 mb-4">
                <TickerItemSkeleton />
                <TickerItemSkeleton />
                <TickerItemSkeleton />
            </div>
        );
    }

    if (!initialData) return null;

    return (
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-0.5 mb-4 animate-fade-in">
            <div className="flex items-center justify-around divide-x divide-white/10">
                <TickerItem label="Dominansi BTC" value={initialData.btc} colorClass="text-electric" />
                <TickerItem label="Dominansi USDT" value={initialData.usdt} colorClass="text-lime" />
                <TickerItem label="Dominansi ALT" value={initialData.alts} colorClass="text-magenta" />
            </div>
        </div>
    );
};

export default DominanceTicker;