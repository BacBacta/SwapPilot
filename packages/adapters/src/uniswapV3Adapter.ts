import type { Adapter, AdapterQuote, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { decodeFunctionResult, encodeFunctionData, isAddress } from 'viem';

// Uniswap V3 Quoter ABI (simplified for quoteExactInputSingle)
const UNISWAP_V3_QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

// Common fee tiers in Uniswap V3 (in basis points * 100)
const FEE_TIERS = [500, 3000, 10000] as const; // 0.05%, 0.3%, 1%

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'UNCERTAIN', confidence: 0.5, reasons: [reason] },
    revertRisk: { level: 'MEDIUM', reasons: [reason] },
    mevExposure: { level: 'HIGH', reasons: ['uniswap_v3_direct'] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.4, confidence: 0.5, reasons: [reason] },
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

export type UniswapV3AdapterConfig = {
  chainId: number;
  rpcUrl: string | null;
  quoterAddress: string | null;
  weth: string; // WETH/WBNB address for native token wrapping
  quoteTimeoutMs?: number;
};

// Known Uniswap V3 Quoter addresses by chain
const QUOTER_ADDRESSES: Record<number, string> = {
  1: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',   // Ethereum
  56: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',  // BSC (PancakeSwap V3 Quoter)
  137: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', // Polygon
  42161: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', // Arbitrum
  10: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',  // Optimism
  8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // Base
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

export class UniswapV3Adapter implements Adapter {
  private readonly chainId: number;
  private readonly rpcUrl: string | null;
  private readonly quoterAddress: string | null;
  private readonly weth: string;
  private readonly quoteTimeoutMs: number;

  constructor(config: UniswapV3AdapterConfig) {
    this.chainId = config.chainId;
    this.rpcUrl = config.rpcUrl;
    this.quoterAddress = config.quoterAddress ?? QUOTER_ADDRESSES[config.chainId] ?? null;
    this.weth = config.weth ?? WRAPPED_NATIVE[config.chainId] ?? '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    this.quoteTimeoutMs = config.quoteTimeoutMs ?? 5000;
  }

  private readonly nativePlaceholders = new Set<string>([
    '0x0000000000000000000000000000000000000000',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase(),
  ]);

  private normalizeToken(token: string): string {
    const t = token.toLowerCase();
    if (this.nativePlaceholders.has(t)) return this.weth;
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
    return Boolean(this.rpcUrl && this.quoterAddress);
  }

  getProviderMeta(): ProviderMeta {
    return {
      providerId: 'uniswap-v3',
      displayName: 'Uniswap V3',
      category: 'dex',
      homepageUrl: 'https://app.uniswap.org',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: false,
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.75 : 0.5,
      notes: this.quoteEnabled()
        ? 'On-chain quote via Uniswap V3 Quoter. Tries multiple fee tiers.'
        : 'Deep-link only. On-chain quoting disabled (missing RPC/Quoter config).',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'uniswap-v3',
      sourceType: 'dex',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('uniswap_v3_adapter'),
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

    // Try all fee tiers and pick the best quote
    let bestBuyAmount = 0n;
    let bestFeeTier: number = FEE_TIERS[1]; // Default to 0.3%

    for (const fee of FEE_TIERS) {
      try {
        const callData = encodeFunctionData({
          abi: UNISWAP_V3_QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [
            tokenIn as `0x${string}`,
            tokenOut as `0x${string}`,
            fee,
            BigInt(request.sellAmount),
            0n, // sqrtPriceLimitX96 = 0 means no limit
          ],
        });

        const result = await this.ethCall({
          to: this.quoterAddress!,
          data: callData,
        });

        const decoded = decodeFunctionResult({
          abi: UNISWAP_V3_QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          data: result,
        });
        const amountOut = decoded as bigint;

        if (amountOut > bestBuyAmount) {
          bestBuyAmount = amountOut;
          bestFeeTier = fee;
        }
      } catch {
        // Fee tier not available for this pair, continue to next
        continue;
      }
    }

    if (bestBuyAmount === 0n) {
      return {
        ...base,
        warnings: ['No liquidity found in any fee tier'],
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
      buyAmount: bestBuyAmount.toString(),
      estimatedGas: 150000, // Typical V3 swap gas
      feeBps: bestFeeTier / 100, // Convert from hundredths of bps to bps
      route: [request.sellToken, request.buyToken],
    };

    return {
      ...base,
      isStub: false,
      raw,
      normalized: {
        ...normalizeQuote(raw),
        estimatedGasUsd: '0.40',
        feesUsd: null,
      },
    };
  }
}
