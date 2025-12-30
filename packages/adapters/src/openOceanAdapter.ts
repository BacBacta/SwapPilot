import type { Adapter, AdapterQuote, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';

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

export class OpenOceanAdapter implements Adapter {
  private readonly chainId: number;
  private readonly chainName: string;
  private readonly apiBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: OpenOceanAdapterConfig) {
    this.chainId = config.chainId;
    this.chainName = CHAIN_NAMES[config.chainId] ?? 'bsc';
    this.apiBaseUrl = config.apiBaseUrl ?? 'https://open-api.openocean.finance/v3';
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private isChainSupported(): boolean {
    return this.chainId in CHAIN_NAMES;
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      // OpenOcean Quote API
      const url = new URL(`${this.apiBaseUrl}/${this.chainName}/quote`);
      url.searchParams.set('inTokenAddress', request.sellToken);
      url.searchParams.set('outTokenAddress', request.buyToken);
      url.searchParams.set('amount', request.sellAmount);
      url.searchParams.set('slippage', String((request.slippageBps ?? 50) / 100));
      url.searchParams.set('gasPrice', '5'); // Default gas price in gwei

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
        throw new Error(`OpenOcean API error: ${res.status} - ${text}`);
      }

      const json = await res.json() as {
        code: number;
        data?: {
          outAmount: string;
          estimatedGas: number;
        };
      };

      if (json.code !== 200 || !json.data) {
        throw new Error(`OpenOcean returned error code: ${json.code}`);
      }

      const raw = {
        sellAmount: request.sellAmount,
        buyAmount: json.data.outAmount,
        estimatedGas: json.data.estimatedGas ?? 200000,
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
}
