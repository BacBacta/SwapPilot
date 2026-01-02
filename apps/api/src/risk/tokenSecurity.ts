import type { RiskSignals } from '@swappilot/shared';

type TokenSecurityConfig = {
  enabled: boolean;
  /** Base URL for GoPlus API, e.g. https://api.gopluslabs.io */
  goPlusBaseUrl: string;
  timeoutMs: number;
  /** Cache TTL to avoid hammering the API */
  cacheTtlMs: number;
};

type CacheEntry = { expiresAt: number; value: RiskSignals['sellability'] };

const cache = new Map<string, CacheEntry>();

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

function parseMaybeNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string' && input.trim().length > 0) {
    const n = Number(input);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Best-effort token security check using GoPlus (BSC only).
 *
 * Goal: detect obvious honeypots / cannot-sell / blacklist scenarios and mark sellability FAIL,
 * even if DEX pools exist.
 */
export async function assessTokenSecuritySellability(params: {
  chainId: number;
  token: string;
  config: TokenSecurityConfig;
}): Promise<RiskSignals['sellability'] | null> {
  const { chainId, token, config } = params;

  if (!config.enabled) return null;
  if (chainId !== 56) {
    return { status: 'UNCERTAIN', confidence: 0.2, reasons: ['token_security:unsupported_chain'] };
  }

  const address = normalizeAddress(token);
  const cacheKey = `${chainId}:${address}`;

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const base = config.goPlusBaseUrl.replace(/\/$/, '');
    const url = `${base}/api/v1/token_security/${chainId}?contract_addresses=${address}`;

    const json = (await fetchJsonWithTimeout(url, config.timeoutMs)) as any;

    const tokenResult = json?.result?.[address];
    if (!tokenResult || typeof tokenResult !== 'object') {
      const value = { status: 'UNCERTAIN' as const, confidence: 0.25, reasons: ['token_security:goplus:no_result'] };
      cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 60_000), value });
      return value;
    }

    const reasons: string[] = ['token_security:goplus:ok'];

    const isHoneypot = tokenResult.is_honeypot === '1';
    const cannotSellAll = tokenResult.cannot_sell_all === '1';
    const isBlacklisted = tokenResult.is_blacklisted === '1';
    const isScam = tokenResult.is_scam === '1';

    const buyTax = parseMaybeNumber(tokenResult.buy_tax);
    const sellTax = parseMaybeNumber(tokenResult.sell_tax);

    if (isHoneypot) reasons.push('token_security:goplus:is_honeypot');
    if (cannotSellAll) reasons.push('token_security:goplus:cannot_sell_all');
    if (isBlacklisted) reasons.push('token_security:goplus:is_blacklisted');
    if (isScam) reasons.push('token_security:goplus:is_scam');

    if (buyTax !== null) reasons.push(`token_security:goplus:buy_tax:${buyTax}`);
    if (sellTax !== null) reasons.push(`token_security:goplus:sell_tax:${sellTax}`);

    // Hard fails
    if (isHoneypot || cannotSellAll || isBlacklisted || isScam) {
      const value = { status: 'FAIL' as const, confidence: 0.95, reasons };
      cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
      return value;
    }

    // Tax-based uncertainty / fail. GoPlus uses percentages (e.g. "10" for 10%).
    const maxTax = Math.max(buyTax ?? 0, sellTax ?? 0);
    if (maxTax >= 40) {
      const value = { status: 'FAIL' as const, confidence: clamp01(0.85), reasons: [...reasons, 'token_security:tax_too_high'] };
      cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
      return value;
    }

    if (maxTax >= 20) {
      const value = { status: 'UNCERTAIN' as const, confidence: clamp01(0.7), reasons: [...reasons, 'token_security:tax_high'] };
      cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
      return value;
    }

    // If GoPlus reports no critical issues, treat as supporting evidence (not absolute proof).
    const value = { status: 'OK' as const, confidence: 0.75, reasons };
    cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
    return value;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const value = { status: 'UNCERTAIN' as const, confidence: 0.2, reasons: ['token_security:error', `token_security:err:${msg}`] };
    cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 30_000), value });
    return value;
  }
}
