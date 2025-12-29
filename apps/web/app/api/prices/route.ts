import { NextResponse } from 'next/server';

// Cache prices for 60 seconds
let cachedPrices: Record<string, { usd: number; usd_24h_change?: number }> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds

const COINGECKO_IDS = [
  'binancecoin',
  'ethereum', 
  'tether',
  'usd-coin',
  'wrapped-bitcoin',
  'pancakeswap-token',
  'solana',
  'binance-usd',
  'dai',
  'chainlink',
  'uniswap',
  'aave',
  'matic-network',
  'arbitrum',
  'optimism',
];

// Fallback prices when API is unavailable
const FALLBACK_PRICES: Record<string, { usd: number; usd_24h_change: number }> = {
  'binancecoin': { usd: 710, usd_24h_change: 1.2 },
  'ethereum': { usd: 3400, usd_24h_change: 0.8 },
  'tether': { usd: 1, usd_24h_change: 0 },
  'usd-coin': { usd: 1, usd_24h_change: 0 },
  'wrapped-bitcoin': { usd: 98000, usd_24h_change: 1.5 },
  'pancakeswap-token': { usd: 2.50, usd_24h_change: -0.5 },
  'solana': { usd: 195, usd_24h_change: 2.1 },
  'binance-usd': { usd: 1, usd_24h_change: 0 },
  'dai': { usd: 1, usd_24h_change: 0 },
  'chainlink': { usd: 23, usd_24h_change: 1.0 },
  'uniswap': { usd: 14, usd_24h_change: 0.3 },
  'aave': { usd: 350, usd_24h_change: 1.8 },
  'matic-network': { usd: 0.55, usd_24h_change: -0.2 },
  'arbitrum': { usd: 0.95, usd_24h_change: 0.5 },
  'optimism': { usd: 2.10, usd_24h_change: 0.7 },
};

export async function GET() {
  const now = Date.now();
  
  // Return cached prices if still valid
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedPrices, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }

  try {
    const ids = COINGECKO_IDS.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }, // Next.js cache
    });

    if (!response.ok) {
      console.warn(`[Prices API] CoinGecko returned ${response.status}, using fallback`);
      return NextResponse.json(FALLBACK_PRICES, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Fallback': 'true',
        },
      });
    }

    const data = await response.json();
    
    // Update cache
    cachedPrices = data;
    cacheTimestamp = now;

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[Prices API] Error fetching prices:', error);
    
    // Return cached data if available, otherwise fallback
    if (cachedPrices) {
      return NextResponse.json(cachedPrices, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cached': 'true',
        },
      });
    }

    return NextResponse.json(FALLBACK_PRICES, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Fallback': 'true',
      },
    });
  }
}
