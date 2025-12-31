import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { decodeFunctionResult, encodeFunctionData, isAddress } from 'viem';

// Uniswap V2 Router ABI
const UNISWAP_V2_ROUTER_ABI = [
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
  // Fee-on-transfer token methods (required for tokens with taxes)
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
    mevExposure: { level: 'HIGH', reasons: ['uniswap_v2_direct'] },
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

export type UniswapV2AdapterConfig = {
  chainId: number;
  rpcUrl: string | null;
  routerAddress: string | null;
  weth: string;
  quoteTimeoutMs?: number;
};

// Known Uniswap V2 Router addresses by chain
const ROUTER_ADDRESSES: Record<number, string> = {
  1: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',   // Ethereum (Uniswap V2)
  56: '0x10ED43C718714eb63d5aA57B78B54704E256024E',  // BSC (PancakeSwap V2)
  137: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // Polygon (QuickSwap)
  42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Arbitrum (SushiSwap)
  10: '0x9c12939390052919aF3155f41Bf4160Fd3666A6f',  // Optimism (Velodrome)
  8453: '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb', // Base (BaseSwap)
};

// WETH/WBNB addresses by chain
const WRAPPED_NATIVE: Record<number, string> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',   // WETH on Ethereum
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',  // WBNB on BSC
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC on Polygon
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
  10: '0x4200000000000000000000000000000000000006',  // WETH on Optimism
  8453: '0x4200000000000000000000000000000000000006', // WETH on Base
};

export class UniswapV2Adapter implements Adapter {
  private readonly chainId: number;
  private readonly rpcUrl: string | null;
  private readonly routerAddress: string | null;
  private readonly weth: string;
  private readonly quoteTimeoutMs: number;

  constructor(config: UniswapV2AdapterConfig) {
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;
    this.routerAddress = config.routerAddress ?? ROUTER_ADDRESSES[config.chainId] ?? null;
    this.weth = config.weth ?? WRAPPED_NATIVE[config.chainId] ?? '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
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
    if (this.isNativeToken(token)) return this.weth;
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
      providerId: 'uniswap-v2',
      displayName: 'Uniswap V2',
      category: 'dex',
      homepageUrl: 'https://app.uniswap.org',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: this.quoteEnabled(),
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.8 : 0.5,
      notes: this.quoteEnabled()
        ? 'On-chain quote + swap via Uniswap V2 Router.'
        : 'Deep-link only. On-chain quoting disabled (missing RPC/Router config).',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'uniswap-v2',
      sourceType: 'dex',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('uniswap_v2_adapter'),
      deepLink: null,
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
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [BigInt(request.sellAmount), path],
      });

      const result = await this.ethCall({
        to: this.routerAddress!,
        data: callData,
      });

      const decoded = decodeFunctionResult({
        abi: UNISWAP_V2_ROUTER_ABI,
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
        estimatedGas: 120000, // Typical V2 swap gas
        feeBps: 30, // 0.3% standard V2 fee
        route: [request.sellToken, request.buyToken],
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: '0.30',
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

  /**
   * Build a ready-to-sign transaction for Uniswap V2 swap.
   * Uses SupportingFeeOnTransferTokens methods by default for better compatibility
   * with tokens that have taxes/fees on transfer (common on BSC).
   */
  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    if (!this.quoteEnabled()) {
      throw new Error('Uniswap V2 not configured for this chain');
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
    // Default to 2% slippage for better success rate on volatile tokens
    const slippageBps = request.slippageBps ?? 200;
    const amountOutMin = (BigInt(quote.raw.buyAmount) * BigInt(10000 - slippageBps)) / 10000n;
    // 30 minute deadline for network congestion
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
    const to = request.account as `0x${string}`;

    let data: `0x${string}`;
    let value: string;

    if (sellTokenIsNative) {
      // ETH -> Token: Use SupportingFeeOnTransferTokens for compatibility with all tokens
      data = encodeFunctionData({
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
        args: [amountOutMin, path, to, deadline],
      });
      value = amountIn.toString();
    } else if (buyTokenIsNative) {
      // Token -> ETH: Use SupportingFeeOnTransferTokens for compatibility with all tokens
      data = encodeFunctionData({
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
        args: [amountIn, amountOutMin, path, to, deadline],
      });
      value = '0';
    } else {
      // Token -> Token: Use SupportingFeeOnTransferTokens for compatibility with all tokens
      data = encodeFunctionData({
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        args: [amountIn, amountOutMin, path, to, deadline],
      });
      value = '0';
    }

    const result: BuiltTx = {
      to: this.routerAddress!,
      data,
      value,
      gas: '350000', // Higher gas limit for fee-on-transfer tokens
    };

    // For ERC-20 tokens, user needs to approve the router first
    if (!sellTokenIsNative) {
      result.approvalAddress = this.routerAddress!;
    }

    return result;
  }
}
