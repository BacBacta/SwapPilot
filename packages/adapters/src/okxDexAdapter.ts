import type { Adapter, AdapterQuote, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { createHmac } from 'crypto';

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
    revertRisk: { level: 'LOW', reasons: [reason] },
    mevExposure: { level: 'LOW', reasons: ['okx_private_routing'] },
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

export type OkxDexAdapterConfig = {
  apiKey: string | null;
  secretKey: string | null;
  passphrase: string | null;
  chainId: number;
  timeoutMs?: number;
};

// OKX chain ID mapping
const OKX_CHAIN_IDS: Record<number, string> = {
  1: '1',      // Ethereum
  56: '56',    // BSC
  137: '137',  // Polygon
  42161: '42161', // Arbitrum
  10: '10',    // Optimism
  8453: '8453', // Base
  43114: '43114', // Avalanche
};

export class OkxDexAdapter implements Adapter {
  private readonly apiKey: string | null;
  private readonly secretKey: string | null;
  private readonly passphrase: string | null;
  private readonly chainId: number;
  private readonly timeoutMs: number;

  constructor(config: OkxDexAdapterConfig) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.passphrase = config.passphrase;
    this.chainId = config.chainId;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  private quoteEnabled(): boolean {
    return Boolean(this.apiKey && this.secretKey && this.passphrase);
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'okx-dex',
      displayName: 'OKX DEX',
      category: 'aggregator',
      homepageUrl: 'https://www.okx.com/web3/dex',
      capabilities: {
        quote: this.quoteEnabled(),
        // OKX DEX adapter currently supports quotes only.
        // Execution is handled via deep-link in the UI.
        buildTx: false,
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.85 : 0.2,
      notes: this.quoteEnabled()
        ? 'OKX DEX API integration enabled (quote-only)'
        : 'API credentials not configured, deep-link only',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'okx-dex',
      sourceType: 'aggregator',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('okx_adapter'),
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

      const chainIdStr = OKX_CHAIN_IDS[this.chainId] ?? String(this.chainId);
      
      // OKX DEX Aggregator API
      const path = '/api/v5/dex/aggregator/quote';
      const queryParams = new URLSearchParams({
        chainId: chainIdStr,
        fromTokenAddress: this.normalizeNativeToken(request.sellToken),
        toTokenAddress: this.normalizeNativeToken(request.buyToken),
        amount: request.sellAmount,
        slippage: String((request.slippageBps ?? 50) / 10000),
      });
      
      const url = `https://www.okx.com${path}?${queryParams.toString()}`;

      // OKX requires HMAC-SHA256 signature
      const timestamp = new Date().toISOString();
      const preHash = timestamp + 'GET' + path + '?' + queryParams.toString();
      const signature = createHmac('sha256', this.secretKey!)
        .update(preHash)
        .digest('base64');
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'OK-ACCESS-KEY': this.apiKey!,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': this.passphrase!,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OKX API error: ${res.status} - ${text}`);
      }

      const json = await res.json() as {
        code: string;
        data?: Array<{
          toTokenAmount: string;
          estimateGasFee: string;
        }>;
        msg?: string;
      };

      if (json.code !== '0' || !json.data?.[0]) {
        throw new Error(`OKX API error: ${json.msg ?? 'No quote data'}`);
      }

      const quoteData = json.data[0];
      const raw = {
        sellAmount: request.sellAmount,
        buyAmount: quoteData.toTokenAmount,
        estimatedGas: 200000,
        feeBps: 0,
        route: [request.sellToken, request.buyToken],
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: quoteData.estimateGasFee ?? '0.30',
        },
        signals: {
          ...placeholderSignals('okx_live_quote'),
          sellability: { status: 'OK', confidence: 0.9, reasons: ['okx_verified'] },
          mevExposure: { level: 'LOW', reasons: ['okx_private_mempool'] },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ...base,
        isStub: true,
        warnings: [`OKX quote failed: ${message}`],
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
      // OKX uses this format for native tokens
      return '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    return token;
  }
}
