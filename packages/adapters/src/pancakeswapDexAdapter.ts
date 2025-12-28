import type { Adapter, AdapterQuote, ProviderMeta } from './types';

import type { QuoteRequest, RiskSignals } from '@swappilot/shared';

import { decodeFunctionResult, encodeFunctionData, isAddress } from 'viem';

const PANCAKESWAP_V2_ROUTER_ABI = [
  {
    type: 'function',
    name: 'getAmountsOut',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'UNCERTAIN', confidence: 0.4, reasons: [reason] },
    revertRisk: { level: 'MEDIUM', reasons: [reason] },
    mevExposure: { level: 'HIGH', reasons: [reason] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.5, confidence: 0, reasons: [reason] },
  };
}

function normalizeQuoteFromRaw(raw: { sellAmount: string; buyAmount: string }): {
  buyAmount: string;
  effectivePrice: string;
  estimatedGasUsd: null;
  feesUsd: null;
} {
  const buy = BigInt(raw.buyAmount);
  const sell = BigInt(raw.sellAmount);
  const scale = 10n ** 6n;
  const denom = sell === 0n ? 1n : sell;
  const value = (buy * scale) / denom;
  const intPart = value / scale;
  const fracPart = value % scale;
  const frac = fracPart.toString().padStart(6, '0').replace(/0+$/, '');
  const effectivePrice = frac.length === 0 ? intPart.toString() : `${intPart.toString()}.${frac}`;
  return {
    buyAmount: raw.buyAmount,
    effectivePrice,
    estimatedGasUsd: null,
    feesUsd: null,
  };
}

export type PancakeSwapDexAdapterConfig = {
  chainId: number;
  rpcUrl: string | null;
  v2RouterAddress: string | null;
  wbnb: string;
  quoteTimeoutMs: number;
};

export class PancakeSwapDexAdapter implements Adapter {
  constructor(private readonly config: PancakeSwapDexAdapterConfig) {}

  private readonly nativePlaceholders = new Set<string>([
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase(),
  ]);

  private normalizeToken(token: string): string {
    const t = token.toLowerCase();
    if (this.nativePlaceholders.has(t)) return this.config.wbnb;
    return token;
  }

  private async ethCall(params: { to: string; data: `0x${string}` }): Promise<`0x${string}`> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.quoteTimeoutMs);

    try {
      const res = await fetch(this.config.rpcUrl!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{ to: params.to, data: params.data }, 'latest'],
        }),
        signal: controller.signal,
      });

      const json = (await res.json()) as
        | { jsonrpc: '2.0'; id: number; result: `0x${string}` }
        | { jsonrpc: '2.0'; id: number; error: { code: number; message: string } };

      if ('error' in json) throw new Error(`eth_call: ${json.error.message}`);
      return json.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private quoteEnabled(): boolean {
    return Boolean(this.config.rpcUrl && this.config.v2RouterAddress);
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'pancakeswap',
      displayName: 'PancakeSwap',
      category: 'dex',
      homepageUrl: 'https://pancakeswap.finance/swap',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: false,
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.7 : 0.6,
      notes: this.quoteEnabled()
        ? 'On-chain quote enabled via Router.getAmountsOut (v2, direct path only). Deep-link always available.'
        : 'DEX deep-link implemented. On-chain quoting disabled (missing router/RPC config).',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const deepLink = null; // deep-link is assembled in the API via @swappilot/deeplinks

    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'pancakeswap',
      sourceType: 'dex',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('pancakeswap_adapter_placeholder'),
      deepLink,
      warnings: [],
      isStub: true,
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
        normalized: normalizeQuoteFromRaw({ sellAmount: request.sellAmount, buyAmount: '0' }),
      };
    }

    if (request.chainId !== this.config.chainId) {
      return {
        ...base,
        capabilities: { ...base.capabilities, quote: false },
        warnings: ['pancakeswap_quote_disabled_wrong_chain'],
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: normalizeQuoteFromRaw({ sellAmount: request.sellAmount, buyAmount: '0' }),
      };
    }

    const router = this.config.v2RouterAddress!;
    const rpcUrl = this.config.rpcUrl!;

    if (!isAddress(router)) {
      return {
        ...base,
        capabilities: { ...base.capabilities, quote: false },
        warnings: ['pancakeswap_quote_disabled_invalid_router_address'],
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: normalizeQuoteFromRaw({ sellAmount: request.sellAmount, buyAmount: '0' }),
      };
    }

    const sellToken = this.normalizeToken(request.sellToken);
    const buyToken = this.normalizeToken(request.buyToken);

    if (!isAddress(sellToken) || !isAddress(buyToken)) {
      return {
        ...base,
        capabilities: { ...base.capabilities, quote: false },
        warnings: ['pancakeswap_quote_requires_erc20_addresses'],
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: normalizeQuoteFromRaw({ sellAmount: request.sellAmount, buyAmount: '0' }),
      };
    }

    const amountIn = BigInt(request.sellAmount);
    const path = [sellToken, buyToken] as const;

    // If we mapped a native placeholder, ensure WBNB itself is sane.
    if ((sellToken === this.config.wbnb || buyToken === this.config.wbnb) && !isAddress(this.config.wbnb)) {
      return {
        ...base,
        capabilities: { ...base.capabilities, quote: false },
        warnings: ['pancakeswap_quote_disabled_invalid_wbnb_address'],
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: normalizeQuoteFromRaw({ sellAmount: request.sellAmount, buyAmount: '0' }),
      };
    }

    try {
      const data = encodeFunctionData({
        abi: PANCAKESWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, [...path]],
      });

      void rpcUrl; // validated via quoteEnabled(); kept for readability
      const result = await this.ethCall({ to: router, data });

      const decoded = decodeFunctionResult({
        abi: PANCAKESWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        data: result,
      }) as readonly bigint[];

      const out = decoded[decoded.length - 1] ?? 0n;

      const raw = {
        sellAmount: request.sellAmount,
        buyAmount: out.toString(),
        estimatedGas: null,
        feeBps: null,
        route: [sellToken, buyToken],
      };

      return {
        ...base,
        isStub: false,
        capabilities: { ...base.capabilities, quote: true },
        raw,
        normalized: normalizeQuoteFromRaw({ sellAmount: raw.sellAmount, buyAmount: raw.buyAmount }),
      };
    } catch (err) {
      return {
        ...base,
        capabilities: { ...base.capabilities, quote: false },
        warnings: [`pancakeswap_quote_failed:${err instanceof Error ? err.message : 'unknown'}`],
        raw: {
          sellAmount: request.sellAmount,
          buyAmount: '0',
          estimatedGas: null,
          feeBps: null,
          route: [request.sellToken, request.buyToken],
        },
        normalized: normalizeQuoteFromRaw({ sellAmount: request.sellAmount, buyAmount: '0' }),
      };
    }
  }
}
