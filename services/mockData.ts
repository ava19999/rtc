// ava19999/rtc/rtc-09b2646bbe674aaaa08c62f5338b30469b9e2c8d/services/mockData.ts
import { COINGECKO_API_BASE_URL, NEWS_API_URL, MAJOR_EXCHANGES } from '../constants';
// Fix: Imported CACHE_DURATION to resolve reference errors.
import { apiRequest, CACHE_DURATION } from './apiService';
import type { CoinListItem, CryptoData, ExchangeTicker, MarketDominance, NewsArticle } from '../types';

// Memetakan respons API CoinGecko ke tipe CryptoData kita
const mapCoinGeckoToCryptoData = (apiData: any): CryptoData => ({
  id: apiData.id,
  name: apiData.name,
  symbol: apiData.symbol.toUpperCase(),
  price: apiData.current_price,
  change: apiData.price_change_percentage_24h,
  image: apiData.image,
  sparkline_in_7d: { price: apiData.sparkline_in_7d?.price || [] },
  high_24h: apiData.high_24h,
  low_24h: apiData.low_24h,
  market_cap: apiData.market_cap,
});

export const fetchIdrRate = async (): Promise<number> => {
    const url = `${COINGECKO_API_BASE_URL}/simple/price?ids=tether&vs_currencies=idr`;
    const data = await apiRequest(url, CACHE_DURATION.DEFAULT);
    return data?.tether?.idr || 16000; // Kurs fallback
};

export const fetchTrendingCoins = async (): Promise<CryptoData[]> => {
    const trendingUrl = `${COINGECKO_API_BASE_URL}/search/trending`;
    const trendingData = await apiRequest(trendingUrl, CACHE_DURATION.DEFAULT);
    const trendingIds = trendingData.coins.map((c: any) => c.item.id).slice(0, 7).join(',');

    if (!trendingIds) return [];

    const coinsUrl = `${COINGECKO_API_BASE_URL}/coins/markets?vs_currency=usd&ids=${trendingIds}&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h`;
    const coinsData = await apiRequest(coinsUrl, CACHE_DURATION.DEFAULT);
    return coinsData.map(mapCoinGeckoToCryptoData);
};

export const fetchMarketDominance = async (): Promise<MarketDominance> => {
    const url = `${COINGECKO_API_BASE_URL}/global`;
    const data = await apiRequest(url, CACHE_DURATION.DEFAULT);
    const btc = data.data.market_cap_percentage.btc;
    const usdt = data.data.market_cap_percentage.usdt;
    const alts = 100 - btc - usdt;
    return { btc, usdt, alts };
};

export const fetchTop500Coins = async (): Promise<CoinListItem[]> => {
    const url1 = `${COINGECKO_API_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`;
    const url2 = `${COINGECKO_API_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2&sparkline=false`;

    const [coinsData1, coinsData2] = await Promise.all([
        apiRequest(url1, CACHE_DURATION.LONG),
        apiRequest(url2, CACHE_DURATION.LONG)
    ]);
    
    const fullList = [...coinsData1, ...coinsData2];
    return fullList.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
    }));
};

export const fetchCoinDetails = async (coinId: string): Promise<CryptoData> => {
    const url = `${COINGECKO_API_BASE_URL}/coins/markets?vs_currency=usd&ids=${coinId}&sparkline=true`;
    const coinsData = await apiRequest(url, CACHE_DURATION.DEFAULT);
    if (!coinsData || coinsData.length === 0) throw new Error("Koin tidak ditemukan");
    return mapCoinGeckoToCryptoData(coinsData[0]);
};

// --- TAMBAHAN FUNGSI BARU ---
export const fetchSpecificCoins = async (coinIds: string[]): Promise<CryptoData[]> => {
    if (!coinIds || coinIds.length === 0) return [];
    
    const idsString = coinIds.join(',');
    // Ambil data pasar untuk koin-koin spesifik
    const url = `${COINGECKO_API_BASE_URL}/coins/markets?vs_currency=usd&ids=${idsString}&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h`;
    
    // Gunakan cache durasi pendek agar harga tetap update
    const coinsData = await apiRequest(url, CACHE_DURATION.SHORT); 
    
    if (!coinsData || !Array.isArray(coinsData)) {
        throw new Error("Gagal mengambil data koin spesifik.");
    }
    
    // Urutkan berdasarkan urutan coinIds asli
    const sortedCoins = coinsData.sort((a, b) => coinIds.indexOf(a.id) - coinIds.indexOf(b.id));
    
    return sortedCoins.map(mapCoinGeckoToCryptoData);
};
// --- AKHIR TAMBAHAN ---

export const fetchExchangeTickers = async (coinId: string): Promise<ExchangeTicker[]> => {
    const url = `${COINGECKO_API_BASE_URL}/coins/${coinId}/tickers?include_exchange_logo=true`;
    const data = await apiRequest(url, CACHE_DURATION.SHORT);
    const uniqueExchanges = new Set();
    const filteredTickers = data.tickers
        .filter((t: any) => {
            const isMajor = MAJOR_EXCHANGES.includes(t.market.identifier);
            const isUsdtPair = t.target === 'USDT';
            const isUnique = !uniqueExchanges.has(t.market.identifier);
            if(isMajor && isUsdtPair && isUnique) {
                uniqueExchanges.add(t.market.identifier);
                return true;
            }
            return false;
        })
        .slice(0, 6);

    return filteredTickers.map((ticker: any) => ({
        name: ticker.market.name,
        logo: ticker.market.logo,
        price: ticker.converted_last.usd,
        tradeUrl: ticker.trade_url,
    }));
};

export const fetchNewsArticles = async (): Promise<NewsArticle[]> => {
    const data = await apiRequest(NEWS_API_URL, CACHE_DURATION.NEWS);
    return data.Data.map((article: any) => ({
        id: article.url, // Gunakan URL sebagai ID unik
        title: article.title,
        url: article.url,
        imageurl: article.imageurl,
        published_on: article.published_on,
        source: article.source_info.name,
        body: article.body,
        reactions: {},
    })).slice(0, 20); // Batasi hingga 20 artikel
};