import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
    revertRisk: { level: 'LOW', reasons: [reason] },
    mevExposure: { level: 'LOW', reasons: ['kyber_protected'] },
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

export type KyberSwapAdapterConfig = {
  chainId: number;
  clientId?: string;
  timeoutMs?: number;
};

// KyberSwap chain slug mapping
const KYBER_CHAIN_SLUGS: Record<number, string> = {
  1: 'ethereum',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  43114: 'avalanche',
  250: 'fantom',
  25: 'cronos',
  324: 'zksync',
  59144: 'linea',
  534352: 'scroll',
};

export class KyberSwapAdapter implements Adapter {
  private readonly chainId: number;
  private readonly clientId: string;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(config: KyberSwapAdapterConfig) {
    this.chainId = config.chainId;
    this.clientId = config.clientId ?? 'swappilot';
    this.timeoutMs = config.timeoutMs ?? 10000;
    
    const chainSlug = KYBER_CHAIN_SLUGS[this.chainId];
    this.baseUrl = chainSlug
      ? `https://aggregator-api.kyberswap.com/${chainSlug}/api/v1`
      : '';
  }

  private isSupported(): boolean {
    return Boolean(KYBER_CHAIN_SLUGS[this.chainId]);
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'kyberswap',
      displayName: 'KyberSwap',
      category: 'aggregator',
      homepageUrl: 'https://kyberswap.com',
      capabilities: {
        quote: this.isSupported(),
        buildTx: this.isSupported(),
        deepLink: true,
      },
      integrationConfidence: this.isSupported() ? 0.85 : 0.15,
      notes: this.isSupported()
        ? 'KyberSwap Aggregator API - no API key required'
        : `Chain ${this.chainId} not supported by KyberSwap`,
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'kyberswap',
      sourceType: 'aggregator',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('kyberswap_adapter'),
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

      // KyberSwap Aggregator API - free, no API key required
      const url = new URL(`${this.baseUrl}/routes`);
      url.searchParams.set('tokenIn', this.normalizeToken(request.sellToken));
      url.searchParams.set('tokenOut', this.normalizeToken(request.buyToken));
      url.searchParams.set('amountIn', request.sellAmount);
      url.searchParams.set('saveGas', 'false');
      url.searchParams.set('gasInclude', 'true');
      url.searchParams.set('clientData', JSON.stringify({ source: this.clientId }));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-client-id': this.clientId,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`KyberSwap API error: ${res.status} - ${text}`);
      }

      const json = await res.json() as {
        code: number;
        message?: string;
        data?: {
          routeSummary: {
            amountIn: string;
            amountOut: string;
            amountOutUsd: string;
            gas: string;
            gasUsd: string;
            route: Array<Array<{
              pool: string;
              tokenIn: string;
              tokenOut: string;
              swapAmount: string;
              amountOut: string;
            }>>;
          };
          routerAddress: string;
        };
      };

      if (json.code !== 0 || !json.data?.routeSummary) {
        throw new Error(json.message ?? 'No route found');
      }

      const summary = json.data.routeSummary;
      const raw = {
        sellAmount: summary.amountIn,
        buyAmount: summary.amountOut,
        estimatedGas: parseInt(summary.gas, 10) || 200000,
        feeBps: 0,
        route: this.extractRoute(summary.route),
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: summary.gasUsd ?? null,
        },
        signals: {
          ...placeholderSignals('kyberswap_live_quote'),
          sellability: { status: 'OK', confidence: 0.9, reasons: ['kyberswap_verified'] },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ...base,
        isStub: true,
        warnings: [`KyberSwap quote failed: ${message}`],
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
   * Build a ready-to-sign transaction using KyberSwap's build endpoint.
   * Flow:
   * - GET /routes to get a fresh routeSummary
   * - POST /route/build with routeSummary + sender/recipient
   */
  async buildTx(request: QuoteRequest, _quote: AdapterQuote): Promise<BuiltTx> {
    if (!this.isSupported()) {
      throw new Error(`Chain ${this.chainId} not supported by KyberSwap`);
    }

    if (!request.account) {
      throw new Error('Account address required for building transaction');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // 1) Fetch a fresh route summary.
      const routesUrl = new URL(`${this.baseUrl}/routes`);
      routesUrl.searchParams.set('tokenIn', this.normalizeToken(request.sellToken));
      routesUrl.searchParams.set('tokenOut', this.normalizeToken(request.buyToken));
      routesUrl.searchParams.set('amountIn', request.sellAmount);
      routesUrl.searchParams.set('saveGas', 'false');
      routesUrl.searchParams.set('gasInclude', 'true');
      routesUrl.searchParams.set('clientData', JSON.stringify({ source: this.clientId }));

      const routesRes = await fetch(routesUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-client-id': this.clientId,
        },
        signal: controller.signal,
      });

      if (!routesRes.ok) {
        const text = await routesRes.text();
        throw new Error(`KyberSwap routes API error: ${routesRes.status} - ${text}`);
      }

      const routesJson = (await routesRes.json()) as {
        code: number;
        message?: string;
        data?: {
          routeSummary?: unknown;
        };
      };

      if (routesJson.code !== 0 || !routesJson.data?.routeSummary) {
        throw new Error(routesJson.message ?? 'KyberSwap: no route found');
      }

      // 2) Build calldata.
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60; // 20 minutes
      const slippageTolerance = request.slippageBps ?? 100;

      const buildRes = await fetch(`${this.baseUrl}/route/build`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
        },
        body: JSON.stringify({
          routeSummary: routesJson.data.routeSummary,
          sender: request.account,
          recipient: request.account,
          slippageTolerance,
          deadline,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!buildRes.ok) {
        const text = await buildRes.text();
        throw new Error(`KyberSwap build API error: ${buildRes.status} - ${text}`);
      }

      const buildJson = (await buildRes.json()) as {
        code: number;
        message?: string;
        data?: {
          routerAddress?: string;
          transactionValue?: string;
          gas?: string;
          data?: string;
        };
      };

      if (buildJson.code !== 0 || !buildJson.data?.routerAddress || !buildJson.data?.data) {
        throw new Error(buildJson.message ?? 'KyberSwap: failed to build transaction');
      }

      return {
        to: buildJson.data.routerAddress,
        data: buildJson.data.data,
        value: buildJson.data.transactionValue ?? '0',
        gas: buildJson.data.gas,
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private normalizeToken(token: string): string {
    const lower = token.toLowerCase();
    // KyberSwap uses 0xEee... for native tokens
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
    routeData: Array<Array<{ tokenIn: string; tokenOut: string }>>
  ): string[] {
    if (!routeData.length || !routeData[0]?.length) {
      return [];
    }
    const firstStep = routeData[0][0];
    if (!firstStep) {
      return [];
    }
    const tokens: string[] = [firstStep.tokenIn];
    for (const path of routeData) {
      for (const step of path) {
        if (!tokens.includes(step.tokenOut)) {
          tokens.push(step.tokenOut);
        }
      }
    }
    return tokens;
  }

  private buildDeepLink(request: QuoteRequest): string | null {
    const chainSlug = KYBER_CHAIN_SLUGS[this.chainId];
    if (!chainSlug) return null;
    
    return `https://kyberswap.com/swap/${chainSlug}/${request.sellToken}-to-${request.buyToken}`;
  }
}
