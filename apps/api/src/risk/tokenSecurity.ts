import type { RiskSignals } from '@swappilot/shared';
import type { QuoteMode } from '@swappilot/shared';

type TokenSecurityConfig = {
  enabled: boolean;
  goPlusEnabled: boolean;
  /** Base URL for GoPlus API, e.g. https://api.gopluslabs.io */
  goPlusBaseUrl: string;
  honeypotIsEnabled: boolean;
  /** Base URL for Honeypot.is API, e.g. https://api.honeypot.is */
  honeypotIsBaseUrl: string;
  timeoutMs: number;
  /** Cache TTL to avoid hammering the API */
  cacheTtlMs: number;
  /** Strict max tax percent (SAFE mode). */
  taxStrictMaxPercent: number;
};

type CacheEntry = { expiresAt: number; value: RiskSignals['sellability'] };

const cache = new Map<string, CacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function clampPercent(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
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

type OracleAssessment = {
  sellability: RiskSignals['sellability'];
  /** Best-effort max tax percentage for policy decisions (buy/sell/transfer). */
  maxTaxPercent: number | null;
};

async function assessGoPlus(params: {
  chainId: number;
  token: string;
  baseUrl: string;
  timeoutMs: number;
}): Promise<OracleAssessment> {
  const { chainId, token, baseUrl, timeoutMs } = params;

  const address = normalizeAddress(token);
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v1/token_security/${chainId}?contract_addresses=${address}`;
  const json = await fetchJsonWithTimeout(url, timeoutMs);

  const tokenResult = isRecord(json) && isRecord(json.result) ? json.result[address] : undefined;
  if (!isRecord(tokenResult)) {
    return {
      sellability: { status: 'UNCERTAIN', confidence: 0.25, reasons: ['token_security:goplus:no_result'] },
      maxTaxPercent: null,
    };
  }

  const reasons: string[] = ['token_security:goplus:ok'];

  const isHoneypot = tokenResult['is_honeypot'] === '1';
  const cannotSellAll = tokenResult['cannot_sell_all'] === '1';
  const isBlacklisted = tokenResult['is_blacklisted'] === '1';
  const isScam = tokenResult['is_scam'] === '1';

  const buyTax = parseMaybeNumber(tokenResult['buy_tax']);
  const sellTax = parseMaybeNumber(tokenResult['sell_tax']);

  if (isHoneypot) reasons.push('token_security:goplus:is_honeypot');
  if (cannotSellAll) reasons.push('token_security:goplus:cannot_sell_all');
  if (isBlacklisted) reasons.push('token_security:goplus:is_blacklisted');
  if (isScam) reasons.push('token_security:goplus:is_scam');

  if (buyTax !== null) reasons.push(`token_security:goplus:buy_tax:${buyTax}`);
  if (sellTax !== null) reasons.push(`token_security:goplus:sell_tax:${sellTax}`);

  const maxTaxPercent = clampPercent(Math.max(buyTax ?? 0, sellTax ?? 0));

  // Hard fails
  if (isHoneypot || cannotSellAll || isBlacklisted || isScam) {
    return {
      sellability: { status: 'FAIL', confidence: 0.95, reasons },
      maxTaxPercent,
    };
  }

  // GoPlus reports no critical issues => supporting evidence.
  return {
    sellability: { status: 'OK', confidence: 0.75, reasons },
    maxTaxPercent: buyTax == null && sellTax == null ? null : maxTaxPercent,
  };
}

function chainParamForHoneypotIs(chainId: number): string | null {
  if (chainId === 56) return 'bsc';
  return null;
}

async function assessHoneypotIs(params: {
  chainId: number;
  token: string;
  baseUrl: string;
  timeoutMs: number;
}): Promise<OracleAssessment> {
  const { chainId, token, baseUrl, timeoutMs } = params;

  const chain = chainParamForHoneypotIs(chainId);
  if (!chain) {
    return {
      sellability: { status: 'UNCERTAIN', confidence: 0.2, reasons: ['token_security:honeypotis:unsupported_chain'] },
      maxTaxPercent: null,
    };
  }

  const address = normalizeAddress(token);
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/v2/IsHoneypot?address=${address}&chain=${chain}`;
  const json = await fetchJsonWithTimeout(url, timeoutMs);

  const reasons: string[] = ['token_security:honeypotis:ok'];

  const simulationSuccessRaw = isRecord(json) ? json['simulationSuccess'] : undefined;
  const simulationSuccess = typeof simulationSuccessRaw === 'boolean' ? simulationSuccessRaw : undefined;
  const honeypotResult = isRecord(json) ? json['honeypotResult'] : undefined;
  const isHoneypot = isRecord(honeypotResult) ? Boolean(honeypotResult['isHoneypot']) : false;

  const simulationResult = isRecord(json) ? json['simulationResult'] : undefined;
  const buyTax = parseMaybeNumber(isRecord(simulationResult) ? simulationResult['buyTax'] : undefined);
  const sellTax = parseMaybeNumber(isRecord(simulationResult) ? simulationResult['sellTax'] : undefined);
  const transferTax = parseMaybeNumber(isRecord(simulationResult) ? simulationResult['transferTax'] : undefined);

  // holderAnalysis contains real-world observed taxes from actual holder sells
  const holderAnalysis = isRecord(json) ? json['holderAnalysis'] : undefined;
  const holderAvgTax = parseMaybeNumber(isRecord(holderAnalysis) ? holderAnalysis['averageTax'] : undefined);
  const holderHighestTax = parseMaybeNumber(isRecord(holderAnalysis) ? holderAnalysis['highestTax'] : undefined);

  if (typeof simulationSuccess === 'boolean') {
    reasons.push(`token_security:honeypotis:simulation_success:${simulationSuccess ? 1 : 0}`);
  }

  if (buyTax !== null) reasons.push(`token_security:honeypotis:buy_tax:${buyTax}`);
  if (sellTax !== null) reasons.push(`token_security:honeypotis:sell_tax:${sellTax}`);
  if (transferTax !== null) reasons.push(`token_security:honeypotis:transfer_tax:${transferTax}`);
  if (holderAvgTax !== null) reasons.push(`token_security:honeypotis:holder_avg_tax:${holderAvgTax}`);
  if (holderHighestTax !== null) reasons.push(`token_security:honeypotis:holder_highest_tax:${holderHighestTax}`);

  // Use the maximum of simulation taxes AND observed holder taxes for the strictest assessment
  const allTaxes = [buyTax, sellTax, transferTax, holderAvgTax].filter((x): x is number => x !== null);
  const maxTaxPercent = allTaxes.length > 0 ? clampPercent(Math.max(...allTaxes)) : null;

  if (isHoneypot) {
    return {
      sellability: { status: 'FAIL', confidence: 0.95, reasons: [...reasons, 'token_security:honeypotis:is_honeypot'] },
      maxTaxPercent,
    };
  }

  if (simulationSuccess === false) {
    return {
      sellability: { status: 'UNCERTAIN', confidence: 0.3, reasons: [...reasons, 'token_security:honeypotis:simulation_failed'] },
      maxTaxPercent: null,
    };
  }

  return {
    sellability: { status: 'OK', confidence: 0.8, reasons },
    maxTaxPercent,
  };
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
  mode: QuoteMode;
  config: TokenSecurityConfig;
}): Promise<RiskSignals['sellability'] | null> {
  const { chainId, token, mode, config } = params;

  if (!config.enabled) return null;
  if (chainId !== 56) {
    return { status: 'UNCERTAIN', confidence: 0.2, reasons: ['token_security:unsupported_chain'] };
  }

  const anyOracleEnabled = Boolean(config.goPlusEnabled || config.honeypotIsEnabled);
  if (!anyOracleEnabled) return null;

  const address = normalizeAddress(token);
  const cacheKey = `${chainId}:${address}`;

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    const assessments: Array<OracleAssessment & { oracle: 'goplus' | 'honeypotis' }> = [];

    if (config.goPlusEnabled) {
      const goPlus = await assessGoPlus({
        chainId,
        token: address,
        baseUrl: config.goPlusBaseUrl,
        timeoutMs: config.timeoutMs,
      });
      assessments.push({ ...goPlus, oracle: 'goplus' });
    }

    if (config.honeypotIsEnabled) {
      const honeypotIs = await assessHoneypotIs({
        chainId,
        token: address,
        baseUrl: config.honeypotIsBaseUrl,
        timeoutMs: config.timeoutMs,
      });
      assessments.push({ ...honeypotIs, oracle: 'honeypotis' });
    }

    const reasons = assessments.flatMap((a) => a.sellability.reasons);
    const maxConfidence = Math.max(...assessments.map((a) => a.sellability.confidence), 0);

    // Any strong FAIL overrides.
    const strongFail = assessments.find((a) => a.sellability.status === 'FAIL' && a.sellability.confidence >= 0.8);
    if (strongFail) {
      const value = { status: 'FAIL' as const, confidence: maxConfidence, reasons };
      cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
      return value;
    }

    // SAFE (ultra-secure): require multi-oracle agreement and strict tax threshold.
    if (mode === 'SAFE') {
      const enabledOracleCount = Number(config.goPlusEnabled) + Number(config.honeypotIsEnabled);
      if (enabledOracleCount < 2) {
        const value = {
          status: 'UNCERTAIN' as const,
          confidence: clamp01(Math.max(0.25, maxConfidence)),
          reasons: [...reasons, 'token_security:multi_oracle_required'],
        };
        cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 60_000), value });
        return value;
      }

      const allOk = assessments.every((a) => a.sellability.status === 'OK');
      if (!allOk) {
        const value = {
          status: 'UNCERTAIN' as const,
          confidence: clamp01(Math.max(0.3, maxConfidence)),
          reasons: [...reasons, 'token_security:oracle_not_ok'],
        };
        cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 60_000), value });
        return value;
      }

      const taxes = assessments.map((a) => a.maxTaxPercent).filter((x): x is number => typeof x === 'number');
      if (taxes.length < enabledOracleCount) {
        const value = {
          status: 'UNCERTAIN' as const,
          confidence: clamp01(Math.max(0.3, maxConfidence)),
          reasons: [...reasons, 'token_security:missing_tax_data'],
        };
        cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 60_000), value });
        return value;
      }

      const strictMax = clampPercent(config.taxStrictMaxPercent);
      const maxTax = Math.max(...taxes, 0);
      if (maxTax > strictMax) {
        const value = {
          status: 'FAIL' as const,
          confidence: clamp01(Math.max(0.8, maxConfidence)),
          reasons: [...reasons, `token_security:tax_strict_fail:max:${maxTax}:limit:${strictMax}`],
        };
        cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
        return value;
      }

      const value = { status: 'OK' as const, confidence: clamp01(Math.max(0.8, maxConfidence)), reasons };
      cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
      return value;
    }

    // NORMAL/DEGEN: tax-based soft rules (keep prior behavior-ish).
    const taxes = assessments.map((a) => a.maxTaxPercent).filter((x): x is number => typeof x === 'number');
    const maxTax = taxes.length ? Math.max(...taxes) : null;

    if (maxTax !== null) {
      if (maxTax >= 40) {
        const value = {
          status: 'FAIL' as const,
          confidence: clamp01(Math.max(0.85, maxConfidence)),
          reasons: [...reasons, 'token_security:tax_too_high'],
        };
        cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
        return value;
      }

      if (maxTax >= 20) {
        const value = {
          status: 'UNCERTAIN' as const,
          confidence: clamp01(Math.max(0.7, maxConfidence)),
          reasons: [...reasons, 'token_security:tax_high'],
        };
        cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
        return value;
      }
    }

    // If at least one oracle is OK, treat as supporting evidence.
    if (assessments.some((a) => a.sellability.status === 'OK')) {
      const value = { status: 'OK' as const, confidence: clamp01(Math.max(0.7, maxConfidence)), reasons };
      cache.set(cacheKey, { expiresAt: now + config.cacheTtlMs, value });
      return value;
    }

    const value = { status: 'UNCERTAIN' as const, confidence: clamp01(Math.max(0.25, maxConfidence)), reasons };
    cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 60_000), value });
    return value;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const value = { status: 'UNCERTAIN' as const, confidence: 0.2, reasons: ['token_security:error', `token_security:err:${msg}`] };
    cache.set(cacheKey, { expiresAt: now + Math.min(config.cacheTtlMs, 30_000), value });
    return value;
  }
}
