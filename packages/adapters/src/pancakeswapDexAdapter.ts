import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';

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
  {
    type: 'function',
    name: 'swapExactTokensForTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'swapExactETHForTokens',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'swapExactTokensForETH',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
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

  private isNativeToken(token: string): boolean {
    return this.nativePlaceholders.has(token.toLowerCase());
  }

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

  private buildTxEnabled(): boolean {
    return this.quoteEnabled();
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'pancakeswap',
      displayName: 'PancakeSwap',
      category: 'dex',
      homepageUrl: 'https://pancakeswap.finance/swap',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: this.buildTxEnabled(),
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.9 : 0.6,
      notes: this.quoteEnabled()
        ? 'On-chain quote and buildTx enabled via Router (v2, direct path only). Deep-link always available.'
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

  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    if (!this.buildTxEnabled()) {
      throw new Error('PancakeSwap buildTx not available: missing RPC or router config');
    }

    if (!quote.raw?.buyAmount || quote.raw.buyAmount === '0') {
      throw new Error('Cannot build tx: no valid quote available');
    }

    const router = this.config.v2RouterAddress!;
    const sellTokenIsNative = this.isNativeToken(request.sellToken);
    const buyTokenIsNative = this.isNativeToken(request.buyToken);

    const sellToken = this.normalizeToken(request.sellToken);
    const buyToken = this.normalizeToken(request.buyToken);

    const amountIn = BigInt(request.sellAmount);
    const expectedOut = BigInt(quote.raw.buyAmount);
    // Apply slippage (default 1% = 100 bps)
    const slippageBps = request.slippageBps ?? 100;
    const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;

    const path = [sellToken, buyToken] as `0x${string}`[];
    const to = request.account as `0x${string}`;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

    let data: `0x${string}`;
    let value: string;

    if (sellTokenIsNative) {
      // BNB → Token: use swapExactETHForTokens
      data = encodeFunctionData({
        abi: PANCAKESWAP_V2_ROUTER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [amountOutMin, path, to, deadline],
      });
      value = amountIn.toString();
    } else if (buyTokenIsNative) {
      // Token → BNB: use swapExactTokensForETH
      data = encodeFunctionData({
        abi: PANCAKESWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [amountIn, amountOutMin, path, to, deadline],
      });
      value = '0';
    } else {
      // Token → Token: use swapExactTokensForTokens
      data = encodeFunctionData({
        abi: PANCAKESWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [amountIn, amountOutMin, path, to, deadline],
      });
      value = '0';
    }

    const result: BuiltTx = {
      to: router,
      data,
      value,
      gas: '200000', // Conservative gas estimate for V2 swaps
    };

    // For ERC-20 tokens, user needs to approve the router first
    if (!sellTokenIsNative) {
      result.approvalAddress = router;
    }

    return result;
  }
}
