import type { RiskSignals } from '@swappilot/shared';

const DEFAULT_TIMEOUT_MS = 1_200;

type DexScreenerConfig = {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
  minLiquidityUsd: number;
};

type CacheEntry = { expiresAt: number; value: RiskSignals['sellability'] };

const cache = new Map<string, CacheEntry>();

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function parseMaybeNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const n = Number(input);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function chainParamForDexScreener(chainId: number): string | null {
  if (chainId === 56) return 'bsc';
  return null;
}

export async function assessDexScreenerSellability(params: {
  chainId: number;
  token: string;
  config: DexScreenerConfig;
}): Promise<RiskSignals['sellability'] | null> {
  const { chainId, token, config } = params;

  if (!config.enabled) return null;

  const chain = chainParamForDexScreener(chainId);
  if (!chain) {
    return { status: 'UNCERTAIN', confidence: 0.2, reasons: ['dexscreener:unsupported_chain'] };
  }

  const address = normalizeAddress(token);
  const cacheKey = `${chainId}:${address}`;

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const base = config.baseUrl.replace(/\/$/, '');
    const url = `${base}/token-pairs/v1/${chain}/${address}`;
    const json = await fetchJsonWithTimeout(url, config.timeoutMs);

    if (!Array.isArray(json)) {
      const value = {
        status: 'UNCERTAIN' as const,
        confidence: 0.25,
        reasons: ['dexscreener:unexpected_response'],
      };
      cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 60_000), value });
      return value;
    }

    if (json.length === 0) {
      const value = {
        status: 'FAIL' as const,
        confidence: 0.85,
        reasons: ['dexscreener:no_pairs'],
      };
      cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
      return value;
    }

    const liquidities = json
      .map((pair) => (pair && typeof pair === 'object' ? (pair as Record<string, unknown>)['liquidity'] : undefined))
      .map((liq) => (liq && typeof liq === 'object' ? (liq as Record<string, unknown>)['usd'] : undefined))
      .map((usd) => parseMaybeNumber(usd))
      .filter((x): x is number => x !== null && x >= 0);

    const maxLiquidityUsd = liquidities.length ? Math.max(...liquidities) : null;
    const reasons: string[] = [];

    if (maxLiquidityUsd !== null) {
      reasons.push(`dexscreener:liquidity_usd:max:${maxLiquidityUsd}`);
    } else {
      reasons.push('dexscreener:liquidity_usd:unknown');
    }

    if (maxLiquidityUsd !== null && maxLiquidityUsd >= config.minLiquidityUsd) {
      const value = { status: 'OK' as const, confidence: clamp01(0.8), reasons };
      cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
      return value;
    }

    const value = {
      status: 'FAIL' as const,
      confidence: clamp01(0.85),
      reasons: [
        ...reasons,
        `dexscreener:liquidity_below_min:${maxLiquidityUsd ?? 'unknown'}:min:${config.minLiquidityUsd}`,
      ],
    };
    cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
    return value;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const value = {
      status: 'UNCERTAIN' as const,
      confidence: 0.2,
      reasons: ['dexscreener:error', `dexscreener:err:${msg}`],
    };
    cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 30_000), value });
    return value;
  }
}
