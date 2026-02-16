import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { safeFetch } from '@swappilot/shared';
import { OpenOceanQuoteSchema, OpenOceanSwapSchema, safeJsonParse } from './validation';

/**
 * OpenOcean API expects amount in human-readable units (e.g., "1" for 1 token),
 * but returns amounts in wei. We need to fetch token decimals first to convert.
 */

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
    revertRisk: { level: 'LOW', reasons: [reason] },
    mevExposure: { level: 'MEDIUM', reasons: ['aggregator_routing'] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.08, confidence: 0.8, reasons: [reason] },
  };
}

function normalizeQuote(raw: { sellAmount: string; buyAmount: string }): {
  buyAmount: string;
  effectivePrice: string;
  estimatedGasUsd: string | null;
  feesUsd: string | null;
} {
  const buy = BigInt(raw.buyAmount);
  const sell = BigInt(raw.sellAmount);
  const scale = 10n ** 18n;
  const denom = sell === 0n ? 1n : sell;
  const value = (buy * scale) / denom;
  const intPart = value / scale;
  const fracPart = value % scale;
  const frac = fracPart.toString().padStart(18, '0').slice(0, 8);
  const effectivePrice = `${intPart.toString()}.${frac}`;
  return {
    buyAmount: raw.buyAmount,
    effectivePrice,
    estimatedGasUsd: null,
    feesUsd: null,
  };
}

export type OpenOceanAdapterConfig = {
  chainId: number;
  apiBaseUrl?: string;
  timeoutMs?: number;
};

// OpenOcean chain name mapping
const CHAIN_NAMES: Record<number, string> = {
  1: 'eth',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  43114: 'avax',
  250: 'fantom',
};

// Wrapped native token addresses per chain (OpenOcean uses these for native tokens)
const WRAPPED_NATIVE_TOKENS: Record<number, string> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
  10: '0x4200000000000000000000000000000000000006', // WETH on Optimism
  8453: '0x4200000000000000000000000000000000000006', // WETH on Base
  43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
  250: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83', // WFTM
};

export class OpenOceanAdapter implements Adapter {
  private readonly chainId: number;
  private readonly chainName: string;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;
  
  // Cache for token decimals to avoid repeated API calls
  private tokenDecimalsCache: Map<string, number> = new Map();

  constructor(config: OpenOceanAdapterConfig) {
    this.chainId = config.chainId;
    this.chainName = CHAIN_NAMES[config.chainId] ?? 'bsc';
    // Use V4 API - V3 swap endpoint has issues (NETWORK_ERROR)
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://open-api.openocean.finance/v4';
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private isChainSupported(): boolean {
    return this.chainId in CHAIN_NAMES;
  }

  /**
   * Normalize token address for OpenOcean API.
   * OpenOcean doesn't accept 0xEeee... for native tokens, use wrapped token address instead.
   */
  private normalizeTokenAddress(tokenAddress: string): string {
    const lower = tokenAddress.toLowerCase();
    const nativePlaceholders = [
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      '0x0000000000000000000000000000000000000000',
    ];
    if (nativePlaceholders.includes(lower)) {
      return WRAPPED_NATIVE_TOKENS[this.chainId] ?? tokenAddress;
    }
    return tokenAddress;
  }

  /**
   * Fetch token decimals from OpenOcean token info API.
   * OpenOcean expects amount in human-readable units, so we need decimals to convert.
   */
  private async getTokenDecimals(tokenAddress: string): Promise<number> {
    const cacheKey = `${this.chainId}:${tokenAddress.toLowerCase()}`;
    const cached = this.tokenDecimalsCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // Native token placeholder addresses
    const nativePlaceholders = [
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      '0x0000000000000000000000000000000000000000',
    ];
    if (nativePlaceholders.includes(tokenAddress.toLowerCase())) {
      this.tokenDecimalsCache.set(cacheKey, 18);
      return 18;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const url = new URL(`${this.apiBaseUrl}/${this.chainName}/tokenList`);
      const res = await safeFetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json() as {
          code: number;
          data?: Array<{ address: string; decimals: number }>;
        };
        if (json.code === 200 && json.data) {
          const token = json.data.find(
            (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
          );
          if (token) {
            this.tokenDecimalsCache.set(cacheKey, token.decimals);
            return token.decimals;
          }
        }
      }
    } catch {
      // Fall through to default
    }

    // Default to 18 decimals if we can't determine
    this.tokenDecimalsCache.set(cacheKey, 18);
    return 18;
  }

  /**
   * Convert wei amount to human-readable units for OpenOcean API.
   */
  private weiToHuman(weiAmount: string, decimals: number): string {
    const wei = BigInt(weiAmount);
    const divisor = 10n ** BigInt(decimals);
    const intPart = wei / divisor;
    const fracPart = wei % divisor;
    
    if (fracPart === 0n) {
      return intPart.toString();
    }
    
    // Format fractional part with leading zeros
    const fracStr = fracPart.toString().padStart(decimals, '0');
    // Remove trailing zeros
    const trimmedFrac = fracStr.replace(/0+$/, '');
    
    return trimmedFrac.length > 0 
      ? `${intPart}.${trimmedFrac}`
      : intPart.toString();
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'openocean',
      displayName: 'OpenOcean',
      category: 'aggregator',
      homepageUrl: 'https://openocean.finance',
      capabilities: {
        quote: this.isChainSupported(),
        buildTx: this.isChainSupported(),
        deepLink: true,
      },
      integrationConfidence: 0.85,
      notes: 'OpenOcean DEX Aggregator - cross-chain routing',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'openocean',
      sourceType: 'aggregator',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('openocean_adapter'),
      deepLink: null,
      warnings: [],
      isStub: !this.isChainSupported(),
    };

    if (!this.isChainSupported()) {
      return {
        ...base,
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: {
          buyAmount: '0',
          effectivePrice: '0',
          estimatedGasUsd: null,
          feesUsd: null,
        },
      };
    }

    try {
      // OpenOcean expects amount in human-readable units, not wei
      // Use decimals from request if provided, otherwise fall back to API lookup
      const sellTokenDecimals = request.sellTokenDecimals ?? await this.getTokenDecimals(request.sellToken);
      const humanAmount = this.weiToHuman(request.sellAmount, sellTokenDecimals);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      // OpenOcean Quote API
      const url = new URL(`${this.apiBaseUrl}/${this.chainName}/quote`);
      url.searchParams.set('inTokenAddress', request.sellToken);
      url.searchParams.set('outTokenAddress', request.buyToken);
      url.searchParams.set('amount', humanAmount);
      url.searchParams.set('slippage', String((request.slippageBps ?? 50) / 100));
      url.searchParams.set('gasPrice', '5'); // Default gas price in gwei

      const res = await safeFetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenOcean API error: ${res.status} - ${text}`);
      }

      const json = await safeJsonParse(res, OpenOceanQuoteSchema, 'OpenOcean quote');

      if (json.code !== 200) {
        throw new Error(`OpenOcean returned error code: ${json.code}`);
      }

      const raw = {
        sellAmount: request.sellAmount,
        buyAmount: json.data.outAmount,
        estimatedGas: json.data.estimatedGas 
          ? parseInt(json.data.estimatedGas, 10) || 200000 
          : 200000,
        feeBps: 0,
        route: [request.sellToken, request.buyToken],
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: '0.25',
          feesUsd: '0',
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        ...base,
        warnings: [`OpenOcean quote failed: ${message}`],
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: {
          buyAmount: '0',
          effectivePrice: '0',
          estimatedGasUsd: null,
          feesUsd: null,
        },
      };
    }
  }

  /**
   * Check if a token address represents the native token (ETH/BNB/etc.)
   */
  private isNativeToken(tokenAddress: string): boolean {
    const lower = tokenAddress.toLowerCase();
    return (
      lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      lower === '0x0000000000000000000000000000000000000000'
    );
  }

  /**
   * Build a ready-to-sign transaction using OpenOcean's swap API.
   */
  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    void quote;
    if (!this.isChainSupported()) {
      throw new Error(`Chain ${this.chainId} not supported by OpenOcean`);
    }

    if (!request.account) {
      throw new Error('Account address required for building transaction');
    }

    // OpenOcean expects amount in human-readable units, not wei
    // Use decimals from request if provided, otherwise fall back to API lookup
    const sellTokenDecimals = request.sellTokenDecimals ?? await this.getTokenDecimals(request.sellToken);
    const humanAmount = this.weiToHuman(request.sellAmount, sellTokenDecimals);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const slippage = (request.slippageBps ?? 100) / 100; // Convert bps to percent

      // OpenOcean swap endpoint returns transaction data
      // IMPORTANT: For native token swaps, do NOT normalize to wrapped token
      // OpenOcean expects the native token placeholder and will handle wrapping internally
      const sellTokenIsNative = this.isNativeToken(request.sellToken);
      const buyTokenIsNative = this.isNativeToken(request.buyToken);
      
      // Only normalize output token, keep input as native placeholder if selling native
      const inToken = sellTokenIsNative ? request.sellToken : this.normalizeTokenAddress(request.sellToken);
      const outToken = buyTokenIsNative ? request.buyToken : this.normalizeTokenAddress(request.buyToken);
      
      const url = new URL(`${this.apiBaseUrl}/${this.chainName}/swap`);
      url.searchParams.set('inTokenAddress', inToken);
      url.searchParams.set('outTokenAddress', outToken);
      url.searchParams.set('amount', humanAmount);
      url.searchParams.set('account', request.account);
      url.searchParams.set('slippage', slippage.toString());
      url.searchParams.set('gasPrice', '5'); // Use default gas price

      const res = await safeFetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenOcean swap API error: ${res.status} - ${text}`);
      }

      const json = await safeJsonParse(res, OpenOceanSwapSchema, 'OpenOcean swap');

      if (json.code !== 200) {
        throw new Error(`OpenOcean swap returned error code: ${json.code}`);
      }

      // Fix: If selling native token (BNB/ETH), ensure value is set to sellAmount
      // OpenOcean API sometimes returns value: "0" for native token swaps
      const txValue = sellTokenIsNative ? request.sellAmount : json.data.value;

      return {
        to: json.data.to,
        data: json.data.data,
        value: txValue,
        ...(json.data.gas ? { gas: json.data.gas } : {}),
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
