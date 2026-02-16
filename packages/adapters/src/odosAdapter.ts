import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { safeFetch, withRetries } from '@swappilot/shared';
import { OdosQuoteSchema, OdosAssembleSchema, safeJsonParse } from './validation';

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
    revertRisk: { level: 'LOW', reasons: [reason] },
    mevExposure: { level: 'LOW', reasons: ['odos_smart_routing'] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.05, confidence: 0.85, reasons: [reason] },
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

export type OdosAdapterConfig = {
  chainId: number;
  apiBaseUrl?: string;
  timeoutMs?: number;
};

// Odos chain ID mapping
const CHAIN_IDS: Record<number, number> = {
  1: 1,       // Ethereum
  56: 56,     // BSC
  137: 137,   // Polygon
  42161: 42161, // Arbitrum
  10: 10,     // Optimism
  8453: 8453, // Base
  43114: 43114, // Avalanche
};

export class OdosAdapter implements Adapter {
  private readonly chainId: number;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: OdosAdapterConfig) {
    this.chainId = config.chainId;
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://api.odos.xyz';
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private isChainSupported(): boolean {
    return this.chainId in CHAIN_IDS;
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'odos',
      displayName: 'Odos',
      category: 'aggregator',
      homepageUrl: 'https://app.odos.xyz',
      capabilities: {
        quote: this.isChainSupported(),
        buildTx: this.isChainSupported(),
        deepLink: true,
      },
      integrationConfidence: 0.9,
      notes: 'Odos Smart Order Router - optimized multi-path routing',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'odos',
      sourceType: 'aggregator',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('odos_adapter'),
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      // Odos Quote API
      const quoteBody = {
        chainId: this.chainId,
        inputTokens: [{
          tokenAddress: request.sellToken,
          amount: request.sellAmount,
        }],
        outputTokens: [{
          tokenAddress: request.buyToken,
          proportion: 1,
        }],
        slippageLimitPercent: (request.slippageBps ?? 50) / 100,
        userAddr: request.account ?? '0x0000000000000000000000000000000000000000',
        referralCode: 0,
        compact: true,
      };

      const res = await withRetries(
        () => safeFetch(`${this.apiBaseUrl}/sor/quote/v2`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(quoteBody),
          signal: controller.signal,
        }),
        { maxRetries: 2, signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Odos API error: ${res.status} - ${text.slice(0, 200)}`);
      }

      const data = await safeJsonParse(res, OdosQuoteSchema, 'Odos quote');

      const buyAmount = data.outAmounts?.[0] ?? '0';
      const gasEstimate = typeof data.gasEstimate === 'string'
        ? parseInt(data.gasEstimate, 10) || 200000
        : data.gasEstimate ?? 200000;

      const raw = {
        sellAmount: request.sellAmount,
        buyAmount,
        estimatedGas: gasEstimate,
        feeBps: 0,
        route: [request.sellToken, request.buyToken],
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: '0.30',
          feesUsd: '0',
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return {
        ...base,
        warnings: [`Odos quote failed: ${message}`],
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
   * Build a ready-to-sign transaction using Odos Assemble API.
   * Requires the pathId from the quote response.
   */
  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    void quote;
    if (!this.isChainSupported()) {
      throw new Error(`Chain ${this.chainId} not supported by Odos`);
    }

    if (!request.account) {
      throw new Error('Account address required for building transaction');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // First, get a fresh quote to get the pathId
      const quoteUrl = `${this.apiBaseUrl}/sor/quote/v2`;
      const quoteBody = {
        chainId: this.chainId,
        inputTokens: [{ tokenAddress: request.sellToken, amount: request.sellAmount }],
        outputTokens: [{ tokenAddress: request.buyToken, proportion: 1 }],
        slippageLimitPercent: (request.slippageBps ?? 100) / 100,
        userAddr: request.account,
      };

      const quoteRes = await withRetries(
        () => safeFetch(quoteUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(quoteBody),
          signal: controller.signal,
        }),
        { maxRetries: 2, signal: controller.signal }
      );

      if (!quoteRes.ok) {
        throw new Error(`Odos quote API error: ${quoteRes.status}`);
      }

      const quoteData = await quoteRes.json() as { pathId: string };

      // Now assemble the transaction
      const assembleUrl = `${this.apiBaseUrl}/sor/assemble`;
      const assembleBody = {
        userAddr: request.account,
        pathId: quoteData.pathId,
        simulate: false,
      };

      const assembleRes = await withRetries(
        () => safeFetch(assembleUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assembleBody),
          signal: controller.signal,
        }),
        { maxRetries: 2, signal: controller.signal }
      );

      clearTimeout(timeout);

      if (!assembleRes.ok) {
        const text = await assembleRes.text();
        throw new Error(`Odos assemble API error: ${assembleRes.status} - ${text.slice(0, 200)}`);
      }

      const txData = await safeJsonParse(assembleRes, OdosAssembleSchema, 'Odos assemble');

      return {
        to: txData.transaction.to,
        data: txData.transaction.data,
        value: txData.transaction.value,
        gas: String(txData.transaction.gas),
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
