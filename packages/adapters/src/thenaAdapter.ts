import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';
import type { QuoteRequest, RiskSignals } from '@swappilot/shared';
import { decodeFunctionResult, encodeFunctionData, isAddress } from 'viem';

/**
 * Thena Adapter
 * 
 * THENA is the leading DEX and liquidity layer on BNB Chain, featuring ve(3,3) tokenomics.
 * It offers multiple AMM types: Concentrated Liquidity, Classic V2, 80/20 Balancer-style, and Curve-style Stable.
 * 
 * Router Address (V2): 0xd4ae6eCA985340Dd434D38F470aCCce4DC78D109
 * Router Address (Fusion/CL): 0x327Df1E6de05895d2ab08513aaDD9313Fe505d86
 * 
 * THENA uses a custom router interface with "route" structs instead of simple address arrays.
 * Each route specifies: from, to, stable (bool for stable/volatile pool type)
 */

// Route struct type for THENA
type ThenaRoute = {
  from: `0x${string}`;
  to: `0x${string}`;
  stable: boolean;
};

// Thena Router ABI - uses route structs with stable/volatile flag
const THENA_ROUTER_ABI = [
  {
    type: 'function',
    name: 'getAmountsOut',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { 
        name: 'routes', 
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
        ],
      },
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
      { 
        name: 'routes', 
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
        ],
      },
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
      { 
        name: 'routes', 
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'swapExactTokensForETH',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { 
        name: 'routes', 
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

function placeholderSignals(reason: string): RiskSignals {
  return {
    sellability: { status: 'UNCERTAIN', confidence: 0.5, reasons: [reason] },
    revertRisk: { level: 'MEDIUM', reasons: [reason] },
    mevExposure: { level: 'MEDIUM', reasons: ['thena_ve33_dex'] },
    churn: { level: 'LOW', reasons: [reason] },
    preflight: { ok: true, pRevert: 0.25, confidence: 0.7, reasons: [reason] },
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

export type ThenaAdapterConfig = {
  chainId: number;
  rpcUrl: string | null;
  routerAddress?: string;
  quoteTimeoutMs?: number;
};

// Thena Router addresses by chain
const ROUTER_ADDRESSES: Record<number, string> = {
  56: '0xd4ae6eCA985340Dd434D38F470aCCce4DC78D109', // BSC Thena V2 Router
};

// WBNB address on BSC
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

export class ThenaAdapter implements Adapter {
  private readonly chainId: number;
  private readonly rpcUrl: string | null;
  private readonly routerAddress: string | null;
  private readonly quoteTimeoutMs: number;

  constructor(config: ThenaAdapterConfig) {
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
      providerId: 'thena',
      displayName: 'THENA',
      category: 'dex',
      homepageUrl: 'https://thena.fi',
      capabilities: {
        quote: this.quoteEnabled(),
        buildTx: this.quoteEnabled(),
        deepLink: true,
      },
      integrationConfidence: this.quoteEnabled() ? 0.8 : 0.5,
      notes: this.quoteEnabled()
        ? 'On-chain quote + swap via THENA Router. ve(3,3) liquidity layer on BNB Chain.'
        : 'Deep-link only. On-chain quoting disabled (missing RPC config).',
    };
  }

  getCapabilities() {
    return this.getProviderMeta().capabilities;
  }

  async getQuote(request: QuoteRequest): Promise<AdapterQuote> {
    const base: Omit<AdapterQuote, 'raw' | 'normalized'> = {
      providerId: 'thena',
      sourceType: 'dex',
      capabilities: this.getCapabilities(),
      signals: placeholderSignals('thena_adapter'),
      deepLink: `https://thena.fi/swap?inputCurrency=${request.sellToken}&outputCurrency=${request.buyToken}`,
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
      // THENA uses route structs: { from, to, stable }
      // Try volatile pool first (most common), then stable if volatile fails
      const volatileRoute: ThenaRoute[] = [{ 
        from: tokenIn as `0x${string}`, 
        to: tokenOut as `0x${string}`, 
        stable: false 
      }];
      
      const stableRoute: ThenaRoute[] = [{ 
        from: tokenIn as `0x${string}`, 
        to: tokenOut as `0x${string}`, 
        stable: true 
      }];

      let bestAmountOut = 0n;
      let bestIsStable = false;

      // Try volatile pool
      try {
        const callData = encodeFunctionData({
          abi: THENA_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [BigInt(request.sellAmount), volatileRoute],
        });

        const result = await this.ethCall({
          to: this.routerAddress!,
          data: callData,
        });

        const decoded = decodeFunctionResult({
          abi: THENA_ROUTER_ABI,
          functionName: 'getAmountsOut',
          data: result,
        }) as bigint[];

        const amountOut = decoded[decoded.length - 1] ?? 0n;
        if (amountOut > bestAmountOut) {
          bestAmountOut = amountOut;
          bestIsStable = false;
        }
      } catch {
        // Volatile pool doesn't exist, try stable
      }

      // Try stable pool
      try {
        const callData = encodeFunctionData({
          abi: THENA_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [BigInt(request.sellAmount), stableRoute],
        });

        const result = await this.ethCall({
          to: this.routerAddress!,
          data: callData,
        });

        const decoded = decodeFunctionResult({
          abi: THENA_ROUTER_ABI,
          functionName: 'getAmountsOut',
          data: result,
        }) as bigint[];

        const amountOut = decoded[decoded.length - 1] ?? 0n;
        if (amountOut > bestAmountOut) {
          bestAmountOut = amountOut;
          bestIsStable = true;
        }
      } catch {
        // Stable pool doesn't exist either
      }

      if (bestAmountOut === 0n) {
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
        buyAmount: bestAmountOut.toString(),
        estimatedGas: 180000, // Thena uses slightly more gas due to ve(3,3) logic
        feeBps: bestIsStable ? 4 : 20, // 0.04% for stable, 0.2% for volatile
        route: [request.sellToken, request.buyToken],
        isStable: bestIsStable, // Store for buildTx
      };

      return {
        ...base,
        isStub: false,
        raw,
        normalized: {
          ...normalizeQuote(raw),
          estimatedGasUsd: '0.18',
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
      throw new Error('THENA not configured for this chain');
    }

    if (!request.account) {
      throw new Error('Account address required for building transaction');
    }

    const sellTokenIsNative = this.isNativeToken(request.sellToken);
    const buyTokenIsNative = this.isNativeToken(request.buyToken);

    const tokenIn = this.normalizeToken(request.sellToken) as `0x${string}`;
    const tokenOut = this.normalizeToken(request.buyToken) as `0x${string}`;
    
    // Get stable flag from quote, default to volatile (false)
    const isStable = (quote.raw as { isStable?: boolean }).isStable ?? false;
    
    // Build route struct for THENA
    const routes: ThenaRoute[] = [{ from: tokenIn, to: tokenOut, stable: isStable }];

    const amountIn = BigInt(request.sellAmount);
    const slippageBps = request.slippageBps ?? 200;
    const amountOutMin = (BigInt(quote.raw.buyAmount) * BigInt(10000 - slippageBps)) / 10000n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
    const to = request.account as `0x${string}`;

    let data: `0x${string}`;
    let value: string;

    if (sellTokenIsNative) {
      data = encodeFunctionData({
        abi: THENA_ROUTER_ABI,
        functionName: 'swapExactETHForTokens',
        args: [amountOutMin, routes, to, deadline],
      });
      value = amountIn.toString();
    } else if (buyTokenIsNative) {
      data = encodeFunctionData({
        abi: THENA_ROUTER_ABI,
        functionName: 'swapExactTokensForETH',
        args: [amountIn, amountOutMin, routes, to, deadline],
      });
      value = '0';
    } else {
      data = encodeFunctionData({
        abi: THENA_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [amountIn, amountOutMin, routes, to, deadline],
      });
      value = '0';
    }

    const result: BuiltTx = {
      to: this.routerAddress!,
      data,
      value,
      gas: '350000', // THENA gas usage
    };

    if (!sellTokenIsNative) {
      result.approvalAddress = this.routerAddress!;
    }

    return result;
  }
}
