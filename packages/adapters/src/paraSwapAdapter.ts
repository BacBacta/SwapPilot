import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { safeFetch } from '@swappilot/shared';
import { ParaSwapPriceSchema, ParaSwapTxSchema, safeJsonParse } from './validation';

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

// ParaSwap TokenTransferProxy addresses per chain
// This is the contract that needs approval for ERC-20 swaps
const PARASWAP_TOKEN_TRANSFER_PROXY: Record<number, string> = {
  1: '0x216b4b4ba9f3e719726886d34a177484278bfcae',     // Ethereum
  56: '0x216b4b4ba9f3e719726886d34a177484278bfcae',    // BSC
  137: '0x216b4b4ba9f3e719726886d34a177484278bfcae',   // Polygon
  42161: '0x216b4b4ba9f3e719726886d34a177484278bfcae', // Arbitrum
  10: '0x216b4b4ba9f3e719726886d34a177484278bfcae',    // Optimism
  8453: '0x216b4b4ba9f3e719726886d34a177484278bfcae',  // Base
  43114: '0x216b4b4ba9f3e719726886d34a177484278bfcae', // Avalanche
  250: '0x216b4b4ba9f3e719726886d34a177484278bfcae',   // Fantom
};

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

  private isNativeToken(token: string): boolean {
    const lower = token.toLowerCase();
    return (
      lower === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      lower === 'eth' ||
      lower === 'bnb' ||
      lower === 'matic' ||
      lower === 'avax' ||
      lower === 'ftm' ||
      lower === '0x0000000000000000000000000000000000000000'
    );
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
      url.searchParams.set('srcDecimals', String(request.sellTokenDecimals ?? 18));
      url.searchParams.set('destDecimals', String(request.buyTokenDecimals ?? 18));
      url.searchParams.set('side', 'SELL');
      url.searchParams.set('network', String(this.chainId));
      url.searchParams.set('partner', this.partner);
      url.searchParams.set('version', '5');

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
        throw new Error(`ParaSwap API error: ${res.status} - ${text}`);
      }

      const json = await safeJsonParse(res, ParaSwapPriceSchema, 'ParaSwap price');

      if (!json.priceRoute) {
        throw new Error('ParaSwap API returned no price route');
      }

      const priceRoute = json.priceRoute;
      const raw = {
        sellAmount: priceRoute.srcAmount,
        buyAmount: priceRoute.destAmount,
        estimatedGas: parseInt(priceRoute.gasCost ?? '200000', 10) || 200000,
        feeBps: 0,
        route: this.extractRoute(priceRoute.bestRoute ?? [], request.sellToken, request.buyToken),
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

  /**
   * Build a ready-to-sign transaction using ParaSwap's Transaction API.
   * First gets price route, then builds transaction.
   */
  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    void quote;
    if (!this.isSupported()) {
      throw new Error(`Chain ${this.chainId} not supported by ParaSwap`);
    }

    if (!request.account) {
      throw new Error('Account address required for building transaction');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const srcToken = this.normalizeToken(request.sellToken);
      const destToken = this.normalizeToken(request.buyToken);
      const slippageBps = request.slippageBps ?? 100;

      // Step 1: Get price route (needed for transaction building)
      const priceUrl = new URL(`${this.baseUrl}/prices`);
      priceUrl.searchParams.set('srcToken', srcToken);
      priceUrl.searchParams.set('destToken', destToken);
      priceUrl.searchParams.set('amount', request.sellAmount);
      priceUrl.searchParams.set('srcDecimals', String(request.sellTokenDecimals ?? 18));
      priceUrl.searchParams.set('destDecimals', String(request.buyTokenDecimals ?? 18));
      priceUrl.searchParams.set('side', 'SELL');
      priceUrl.searchParams.set('network', String(this.chainId));
      priceUrl.searchParams.set('partner', this.partner);

      const priceRes = await safeFetch(priceUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      if (!priceRes.ok) {
        throw new Error(`ParaSwap price API error: ${priceRes.status}`);
      }

      const priceData = await priceRes.json() as { priceRoute: Record<string, unknown> };
      const priceRoute = priceData.priceRoute;
      
      if (!priceRoute) {
        throw new Error('ParaSwap price API returned no priceRoute');
      }

      // Step 2: Build transaction
      // ParaSwap requires: for SELL side, use slippage (not destAmount)
      // Use tokens from priceRoute to ensure exact match (case-sensitive!)
      const txUrl = `${this.baseUrl}/transactions/${this.chainId}?ignoreChecks=true&ignoreGasEstimate=true`;
      const txBody = {
        srcToken: priceRoute.srcToken,
        destToken: priceRoute.destToken,
        srcAmount: priceRoute.srcAmount,
        // For SELL side: use slippage, NOT destAmount (cannot specify both)
        slippage: slippageBps / 100, // ParaSwap expects slippage as percentage (1 = 1%)
        priceRoute,
        userAddress: request.account,
        partner: this.partner,
        // Allow transactions even if simulation fails (for fee-on-transfer tokens)
        ignoreChecks: true,
        ignoreGasEstimate: true,
      };

      const txRes = await safeFetch(txUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(txBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!txRes.ok) {
        const text = await txRes.text();
        throw new Error(`ParaSwap transaction API error: ${txRes.status} - ${text}`);
      }

      const txData = await safeJsonParse(txRes, ParaSwapTxSchema, 'ParaSwap tx');

      // For ERC-20 tokens, user needs to approve the TokenTransferProxy first
      const sellTokenIsNative = this.isNativeToken(request.sellToken);
      const approvalAddress = sellTokenIsNative ? undefined : PARASWAP_TOKEN_TRANSFER_PROXY[this.chainId];

      return {
        to: txData.to,
        data: txData.data,
        value: txData.value,
        ...(txData.gas ? { gas: txData.gas } : {}),
        ...(txData.gasPrice ? { gasPrice: txData.gasPrice } : {}),
        ...(approvalAddress ? { approvalAddress } : {}),
      };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}
