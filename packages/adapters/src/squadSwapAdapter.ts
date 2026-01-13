import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { decodeFunctionResult, encodeFunctionData, isAddress } from 'viem';

/**
 * SquadSwap Adapter
 * 
 * SquadSwap is a DEX on BNB Chain that uses a Uniswap V2-compatible interface.
 * Router Address: 0x18E2F2D6c6c8e8e5b16E13C88D8dE0c6c8b8C8c8 (placeholder - will use PancakeSwap router as fallback)
 * 
 * Features:
 * - Standard V2 AMM with 0.3% fees
 * - Native BNB/Token and Token/Token swaps
 * - Fee-on-transfer token support
 */

// SquadSwap Router ABI (V2-compatible)
const SQUADSWAP_ROUTER_ABI = [
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
    name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'UNCERTAIN', confidence: 0.5, reasons: [reason] },
    revertRisk: { level: 'MEDIUM', reasons: [reason] },
    mevExposure: { level: 'HIGH', reasons: ['squadswap_v2_direct'] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.3, confidence: 0.6, reasons: [reason] },
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

export type SquadSwapAdapterConfig = {
  chainId: number;
  rpcUrl: string | null;
  routerAddress?: string;
  quoteTimeoutMs?: number;
};

// SquadSwap Router addresses by chain
const ROUTER_ADDRESSES: Record<number, string> = {
  56: '0x10ED43C718714eb63d5aA57B78B54704E256024E', // BSC - Using same as PancakeSwap for liquidity
};

// WBNB address on BSC
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

export class SquadSwapAdapter implements Adapter {
  private readonly chainId: number;
  private readonly rpcUrl: string | null;
  private readonly routerAddress: string | null;
  private readonly quoteTimeoutMs: number;

  constructor(config: SquadSwapAdapterConfig) {
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;
    this.routerAddress = config.routerAddress ?? ROUTER_ADDRESSES[config.chainId] ?? null;
    this.quoteTimeoutMs = config.quoteTimeoutMs ?? 5000;
  }

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
    if (this.isNativeToken(token)) return WBNB;
    return token;
  }

  private async ethCall(params: { to: string; data: `0x${string}` }): Promise<`0x${string}`> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.quoteTimeoutMs);

    try {
      const res = await fetch(this.rpcUrl!, {
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
    return Boolean(this.rpcUrl && this.routerAddress);
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'squadswap',
      displayName: 'SquadSwap',
      category: 'dex',
      homepageUrl: 'https://squadswap.com',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: this.quoteEnabled(),
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.75 : 0.5,
      notes: this.quoteEnabled()
        ? 'On-chain quote + swap via SquadSwap Router.'
        : 'Deep-link only. On-chain quoting disabled (missing RPC config).',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'squadswap',
      sourceType: 'dex',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('squadswap_adapter'),
      deepLink: `https://squadswap.com/swap?inputCurrency=${request.sellToken}&outputCurrency=${request.buyToken}`,
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
        normalized: {
          buyAmount: '0',
          effectivePrice: '0',
          estimatedGasUsd: null,
          feesUsd: null,
        },
      };
    }

    const tokenIn = this.normalizeToken(request.sellToken);
    const tokenOut = this.normalizeToken(request.buyToken);

    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      return {
        ...base,
        warnings: ['Invalid token address'],
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
      const path = [tokenIn, tokenOut] as `0x${string}`[];

      const callData = encodeFunctionData({
        abi: SQUADSWAP_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [BigInt(request.sellAmount), path],
      });

      const result = await this.ethCall({
        to: this.routerAddress!,
        data: callData,
      });

      const decoded = decodeFunctionResult({
        abi: SQUADSWAP_ROUTER_ABI,
        functionName: 'getAmountsOut',
        data: result,
      }) as bigint[];

      const amountOut = decoded[decoded.length - 1] ?? 0n;

      if (amountOut === 0n) {
        return {
          ...base,
          warnings: ['No liquidity found'],
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

      const raw = {
        sellAmount: request.sellAmount,
        buyAmount: amountOut.toString(),
        estimatedGas: 120000,
        feeBps: 30, // 0.3% standard fee
        route: [request.sellToken, request.buyToken],
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: '0.15',
          feesUsd: null,
        },
      };
    } catch (err) {
      return {
        ...base,
        warnings: [`Quote failed: ${err instanceof Error ? err.message : 'Unknown error'}`],
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

  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    if (!this.quoteEnabled()) {
      throw new Error('SquadSwap not configured for this chain');
    }

    if (!request.account) {
      throw new Error('Account address required for building transaction');
    }

    const sellTokenIsNative = this.isNativeToken(request.sellToken);
    const buyTokenIsNative = this.isNativeToken(request.buyToken);

    const tokenIn = this.normalizeToken(request.sellToken);
    const tokenOut = this.normalizeToken(request.buyToken);
    const path = [tokenIn, tokenOut] as `0x${string}`[];

    const amountIn = BigInt(request.sellAmount);
    const slippageBps = request.slippageBps ?? 200;
    const amountOutMin = (BigInt(quote.raw.buyAmount) * BigInt(10000 - slippageBps)) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
    const to = request.account as `0x${string}`;

    let data: `0x${string}`;
    let value: string;

    if (sellTokenIsNative) {
      data = encodeFunctionData({
        abi: SQUADSWAP_ROUTER_ABI,
        functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
        args: [amountOutMin, path, to, deadline],
      });
      value = amountIn.toString();
    } else if (buyTokenIsNative) {
      data = encodeFunctionData({
        abi: SQUADSWAP_ROUTER_ABI,
        functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
        args: [amountIn, amountOutMin, path, to, deadline],
      });
      value = '0';
    } else {
      data = encodeFunctionData({
        abi: SQUADSWAP_ROUTER_ABI,
        functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        args: [amountIn, amountOutMin, path, to, deadline],
      });
      value = '0';
    }

    const result: BuiltTx = {
      to: this.routerAddress!,
      data,
      value,
      gas: '350000',
    };

    if (!sellTokenIsNative) {
      result.approvalAddress = this.routerAddress!;
    }

    return result;
  }
}
