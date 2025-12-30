import { NextResponse } from 'next/server';

// Cache prices - starts empty, populated on first successful fetch
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

// Initial seed prices - only used if CoinGecko has never responded successfully
// These are intentionally conservative estimates; real prices will replace them on first fetch
const SEED_PRICES: Record<string, { usd: number; usd_24h_change: number }> = {
  'binancecoin': { usd: 700, usd_24h_change: 0 },
  'ethereum': { usd: 3500, usd_24h_change: 0 },
  'tether': { usd: 1, usd_24h_change: 0 },
  'usd-coin': { usd: 1, usd_24h_change: 0 },
  'wrapped-bitcoin': { usd: 95000, usd_24h_change: 0 },
  'pancakeswap-token': { usd: 2.50, usd_24h_change: 0 },
  'solana': { usd: 200, usd_24h_change: 0 },
  'binance-usd': { usd: 1, usd_24h_change: 0 },
  'dai': { usd: 1, usd_24h_change: 0 },
  'chainlink': { usd: 20, usd_24h_change: 0 },
  'uniswap': { usd: 12, usd_24h_change: 0 },
  'aave': { usd: 300, usd_24h_change: 0 },
  'matic-network': { usd: 0.50, usd_24h_change: 0 },
  'arbitrum': { usd: 0.80, usd_24h_change: 0 },
  'optimism': { usd: 2.00, usd_24h_change: 0 },
};

// Use last known good prices as fallback, or seed prices if never fetched
function getFallbackPrices(): Record<string, { usd: number; usd_24h_change?: number }> {
  return cachedPrices ?? SEED_PRICES;
}

export async function GET() {
  const now = Date.now();
  const cacheAgeMs = cachedPrices ? now - cacheTimestamp : null;
  
  // Return cached prices if still valid
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedPrices, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Price-Age-Ms': String(cacheAgeMs ?? 0),
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
      console.warn(`[Prices API] CoinGecko returned ${response.status}, using last known prices`);
      const fallback = getFallbackPrices();
      return NextResponse.json(fallback, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Fallback': 'true',
          'X-Price-Age-Ms': String(cacheAgeMs ?? 'seed'),
        },
      });
    }

    const data = await response.json();
    
    // Update cache with fresh prices
    cachedPrices = data;
    cacheTimestamp = now;

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Price-Age-Ms': '0',
      },
    });
  } catch (error) {
    console.error('[Prices API] Error fetching prices:', error);
    
    // Return last known good prices (dynamic fallback)
    const fallback = getFallbackPrices();
    return NextResponse.json(fallback, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Fallback': 'true',
        'X-Price-Age-Ms': String(cacheAgeMs ?? 'seed'),
      },
    });
  }
}
