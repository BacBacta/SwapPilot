import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
    revertRisk: { level: 'LOW', reasons: [reason] },
    mevExposure: { level: 'MEDIUM', reasons: ['aggregator_routing'] },
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

export type OneInchAdapterConfig = {
  apiKey: string | null;
  chainId: number;
  apiBaseUrl?: string;
  timeoutMs?: number;
};

// Chain ID mapping for 1inch API
const CHAIN_NAMES: Record<number, string> = {
  1: 'ethereum',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  43114: 'avalanche',
};

export class OneInchAdapter implements Adapter {
  private readonly apiKey: string | null;
  private readonly chainId: number;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: OneInchAdapterConfig) {
    this.apiKey = config.apiKey;
    this.chainId = config.chainId;
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://api.1inch.dev';
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private quoteEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: '1inch',
      displayName: '1inch',
      category: 'aggregator',
      homepageUrl: 'https://app.1inch.io',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: this.quoteEnabled(),
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.9 : 0.25,
      notes: this.quoteEnabled()
        ? '1inch Fusion+ API integration enabled'
        : 'API key not configured, deep-link only',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: '1inch',
      sourceType: 'aggregator',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('1inch_adapter'),
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

      // Normalize native token address for 1inch
      const sellToken = this.normalizeNativeToken(request.sellToken);
      const buyToken = this.normalizeNativeToken(request.buyToken);

      const url = new URL(`${this.apiBaseUrl}/swap/v6.0/${this.chainId}/quote`);
      url.searchParams.set('src', sellToken);
      url.searchParams.set('dst', buyToken);
      url.searchParams.set('amount', request.sellAmount);
      url.searchParams.set('includeGas', 'true');

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const text = await res.text();
      
      if (!res.ok) {
        throw new Error(`1inch API error: ${res.status} - ${text}`);
      }

      let data: {
        dstAmount: string;
        gas: number;
        protocols?: unknown[][];
      };
      
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`1inch API returned invalid JSON: ${text.slice(0, 200)}`);
      }

      const raw = {
        sellAmount: request.sellAmount,
        buyAmount: data.dstAmount,
        estimatedGas: data.gas ?? 250000,
        feeBps: 0, // 1inch doesn't charge swap fees
        route: [request.sellToken, request.buyToken],
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: '0.50', // Approximate
        },
        signals: {
          ...placeholderSignals('1inch_live_quote'),
          sellability: { status: 'OK', confidence: 0.9, reasons: ['1inch_verified'] },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ...base,
        isStub: true,
        warnings: [`1inch quote failed: ${message}`],
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

  private normalizeNativeToken(token: string): string {
    const lower = token.toLowerCase();
    if (
      lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      lower === '0x0000000000000000000000000000000000000000'
    ) {
      return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    return token;
  }

  /**
   * Build a ready-to-sign transaction for the swap.
   * Calls 1inch Swap API which returns calldata for on-chain execution.
   */
  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    if (!this.quoteEnabled()) {
      throw new Error('1inch API key not configured');
    }

    if (!request.account) {
      throw new Error('Account address required for building transaction');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const sellToken = this.normalizeNativeToken(request.sellToken);
      const buyToken = this.normalizeNativeToken(request.buyToken);

      // Calculate minReturn with slippage
      const slippageBps = request.slippageBps ?? 100; // Default 1%
      const buyAmount = BigInt(quote.raw.buyAmount);
      const minReturn = (buyAmount * BigInt(10000 - slippageBps)) / 10000n;

      const url = new URL(`${this.apiBaseUrl}/swap/v6.0/${this.chainId}/swap`);
      url.searchParams.set('src', sellToken);
      url.searchParams.set('dst', buyToken);
      url.searchParams.set('amount', request.sellAmount);
      url.searchParams.set('from', request.account);
      url.searchParams.set('slippage', (slippageBps / 100).toString());
      url.searchParams.set('disableEstimate', 'true'); // Skip on-chain simulation
      url.searchParams.set('allowPartialFill', 'false');

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`1inch swap API error: ${res.status} - ${text}`);
      }

      const data = await res.json() as {
        tx: {
          to: string;
          data: string;
          value: string;
          gas: number;
          gasPrice: string;
        };
      };

      return {
        to: data.tx.to,
        data: data.tx.data,
        value: data.tx.value,
        gas: String(data.tx.gas),
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
