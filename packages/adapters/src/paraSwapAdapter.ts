import type { Adapter, AdapterQuote, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
    revertRisk: { level: 'LOW', reasons: [reason] },
    mevExposure: { level: 'LOW', reasons: ['paraswap_protected'] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.1, confidence: 0.8, reasons: [reason] },
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

export type ParaSwapAdapterConfig = {
  chainId: number;
  partner?: string;
  timeoutMs?: number;
};

// ParaSwap uses numeric chain IDs directly
const PARASWAP_SUPPORTED_CHAINS = [
  1,     // Ethereum
  56,    // BSC
  137,   // Polygon
  42161, // Arbitrum
  10,    // Optimism
  8453,  // Base
  43114, // Avalanche
  250,   // Fantom
];

export class ParaSwapAdapter implements Adapter {
  private readonly chainId: number;
  private readonly partner: string;
  private readonly timeoutMs: number;
  private readonly baseUrl = 'https://apiv5.paraswap.io';

  constructor(config: ParaSwapAdapterConfig) {
    this.chainId = config.chainId;
    this.partner = config.partner ?? 'swappilot';
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private isSupported(): boolean {
    return PARASWAP_SUPPORTED_CHAINS.includes(this.chainId);
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'paraswap',
      displayName: 'ParaSwap',
      category: 'aggregator',
      homepageUrl: 'https://www.paraswap.io',
      capabilities: {
        quote: this.isSupported(),
        buildTx: this.isSupported(),
        deepLink: true,
      },
      integrationConfidence: this.isSupported() ? 0.85 : 0.15,
      notes: this.isSupported()
        ? 'ParaSwap API v5 - no API key required'
        : `Chain ${this.chainId} not supported by ParaSwap`,
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'paraswap',
      sourceType: 'aggregator',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('paraswap_adapter'),
      deepLink: this.buildDeepLink(request),
      warnings: [],
      isStub: !this.isSupported(),
    };

    if (!this.isSupported()) {
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      // ParaSwap Prices API - free, no API key required
      const url = new URL(`${this.baseUrl}/prices`);
      url.searchParams.set('srcToken', this.normalizeToken(request.sellToken));
      url.searchParams.set('destToken', this.normalizeToken(request.buyToken));
      url.searchParams.set('amount', request.sellAmount);
      url.searchParams.set('srcDecimals', '18'); // Default to 18 decimals for most tokens
      url.searchParams.set('destDecimals', '18');
      url.searchParams.set('side', 'SELL');
      url.searchParams.set('network', String(this.chainId));
      url.searchParams.set('partner', this.partner);
      url.searchParams.set('version', '5');

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ParaSwap API error: ${res.status} - ${text}`);
      }

      const json = await res.json() as {
        error?: string;
        priceRoute: {
          srcAmount: string;
          destAmount: string;
          gasCost: string;
          gasCostUSD: string;
          bestRoute: Array<{
            swaps: Array<{
              srcToken: string;
              destToken: string;
              exchange: string;
            }>;
          }>;
        };
      };

      if (json.error) {
        throw new Error(json.error);
      }

      const priceRoute = json.priceRoute;
      const raw = {
        sellAmount: priceRoute.srcAmount,
        buyAmount: priceRoute.destAmount,
        estimatedGas: parseInt(priceRoute.gasCost, 10) || 200000,
        feeBps: 0,
        route: this.extractRoute(priceRoute.bestRoute, request.sellToken, request.buyToken),
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: priceRoute.gasCostUSD ?? null,
        },
        signals: {
          ...placeholderSignals('paraswap_live_quote'),
          sellability: { status: 'OK', confidence: 0.9, reasons: ['paraswap_verified'] },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ...base,
        isStub: true,
        warnings: [`ParaSwap quote failed: ${message}`],
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

  private normalizeToken(token: string): string {
    const lower = token.toLowerCase();
    // ParaSwap uses 0xEee... for native tokens
    if (
      lower === '0x0000000000000000000000000000000000000000' ||
      lower === 'eth' ||
      lower === 'bnb' ||
      lower === 'matic'
    ) {
      return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    return token;
  }

  private extractRoute(
    bestRoute: Array<{ swaps: Array<{ srcToken: string; destToken: string }> }>,
    sellToken: string,
    buyToken: string
  ): string[] {
    if (!bestRoute?.length) {
      return [sellToken, buyToken];
    }
    const tokens: string[] = [sellToken];
    for (const route of bestRoute) {
      for (const swap of route.swaps) {
        if (!tokens.includes(swap.destToken)) {
          tokens.push(swap.destToken);
        }
      }
    }
    if (!tokens.includes(buyToken)) {
      tokens.push(buyToken);
    }
    return tokens;
  }

  private buildDeepLink(request: QuoteRequest): string | null {
    // ParaSwap deep link format
    const chainNames: Record<number, string> = {
      1: 'ethereum',
      56: 'bsc',
      137: 'polygon',
      42161: 'arbitrum',
      10: 'optimism',
      8453: 'base',
    };
    const chainName = chainNames[this.chainId];
    if (!chainName) return null;
    
    return `https://app.paraswap.io/#/${chainName}/${request.sellToken}-${request.buyToken}`;
  }
}
