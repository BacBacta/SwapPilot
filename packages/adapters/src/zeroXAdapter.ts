import type { Adapter, AdapterQuote, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { ZeroXQuoteSchema, safeJsonParse } from './validation';

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'OK', confidence: 0.85, reasons: [reason] },
    revertRisk: { level: 'LOW', reasons: [reason] },
    mevExposure: { level: 'LOW', reasons: ['0x_private_market_makers'] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.05, confidence: 0.9, reasons: [reason] },
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

export type ZeroXAdapterConfig = {
  apiKey: string | null;
  chainId: number;
  apiBaseUrl?: string;
  timeoutMs?: number;
};

// 0x API chain endpoints
const CHAIN_ENDPOINTS: Record<number, string> = {
  1: 'https://api.0x.org',
  56: 'https://bsc.api.0x.org',
  137: 'https://polygon.api.0x.org',
  42161: 'https://arbitrum.api.0x.org',
  10: 'https://optimism.api.0x.org',
  8453: 'https://base.api.0x.org',
  43114: 'https://avalanche.api.0x.org',
};

export class ZeroXAdapter implements Adapter {
  private readonly apiKey: string | null;
  private readonly chainId: number;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ZeroXAdapterConfig) {
    this.apiKey = config.apiKey;
    this.chainId = config.chainId;
    this.apiBaseUrl = config.apiBaseUrl ?? CHAIN_ENDPOINTS[config.chainId] ?? CHAIN_ENDPOINTS[56]!;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private quoteEnabled(): boolean {
    return Boolean(this.apiKey) && this.chainId in CHAIN_ENDPOINTS;
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: '0x',
      displayName: '0x',
      category: 'aggregator',
      homepageUrl: 'https://0x.org',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: this.quoteEnabled(),
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.95 : 0.2,
      notes: this.quoteEnabled()
        ? '0x Swap API - professional grade liquidity aggregation'
        : 'API key not configured',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: '0x',
      sourceType: 'aggregator',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('0x_adapter'),
      deepLink: null,
      warnings: [],
      isStub: !this.quoteEnabled(),
    };

    if (!this.quoteEnabled()) {
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

      // 0x Swap API v2
      const url = new URL(`${this.apiBaseUrl}/swap/v1/quote`);
      url.searchParams.set('sellToken', request.sellToken);
      url.searchParams.set('buyToken', request.buyToken);
      url.searchParams.set('sellAmount', request.sellAmount);
      url.searchParams.set('slippagePercentage', String((request.slippageBps ?? 50) / 10000));
      if (request.account) {
        url.searchParams.set('takerAddress', request.account);
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          '0x-api-key': this.apiKey!,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 404 && /no route matched/i.test(text)) {
          return {
            ...base,
            isStub: false,
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
        throw new Error(`0x API error: ${res.status} - ${text}`);
      }

      // Validate response with Zod schema
      const data = await safeJsonParse(res, ZeroXQuoteSchema, '0x quote');

      const gasEstimate = data.estimatedGas || data.gas 
        ? parseInt(String(data.estimatedGas || data.gas), 10) || 200000
        : 200000;

      const raw = {
        sellAmount: request.sellAmount,
        buyAmount: data.buyAmount,
        estimatedGas: gasEstimate,
        feeBps: 0, // 0x doesn't charge swap fees
        route: [request.sellToken, request.buyToken],
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: '0.35',
          feesUsd: '0',
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        ...base,
        warnings: [`0x quote failed: ${message}`],
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
}
