import type { Adapter, AdapterQuote, BuiltTx, ProviderMeta } from './types';

import type { QuoteRequest, RiskSignals } from '@swappilot/shared';

import { decodeFunctionResult, encodeFunctionData, isAddress } from 'viem';

// PancakeSwap V3 Quoter ABI (quoteExactInputSingle)
const PANCAKESWAP_V3_QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

// PancakeSwap V3 SwapRouter ABI
const PANCAKESWAP_V3_ROUTER_ABI = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

// PancakeSwap V3 fee tiers (in basis points * 100)
const V3_FEE_TIERS = [100, 500, 2500, 10000] as const; // 0.01%, 0.05%, 0.25%, 1%

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
  v3QuoterAddress: string | null;
  v3RouterAddress: string | null;
  wbnb: string;
  quoteTimeoutMs: number;
};

// Default PancakeSwap V3 addresses on BSC
const DEFAULT_V3_QUOTER_BSC = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
const DEFAULT_V3_ROUTER_BSC = '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4';

export class PancakeSwapDexAdapter implements Adapter {
  private readonly v3QuoterAddress: string | null;
  private readonly v3RouterAddress: string | null;

  constructor(private readonly config: PancakeSwapDexAdapterConfig) {
    // Use defaults for BSC if not provided
    this.v3QuoterAddress = config.v3QuoterAddress ?? 
      (config.chainId === 56 ? DEFAULT_V3_QUOTER_BSC : null);
    this.v3RouterAddress = config.v3RouterAddress ?? 
      (config.chainId === 56 ? DEFAULT_V3_ROUTER_BSC : null);
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

  private v3QuoteEnabled(): boolean {
    return Boolean(this.config.rpcUrl && this.v3QuoterAddress);
  }

  private v2QuoteEnabled(): boolean {
    return Boolean(this.config.rpcUrl && this.config.v2RouterAddress);
  }

  private quoteEnabled(): boolean {
    return this.v3QuoteEnabled() || this.v2QuoteEnabled();
  }

  private buildTxEnabled(): boolean {
    return this.quoteEnabled();
  }

  /**
   * Try V3 quote across all fee tiers, return best result
   */
  private async tryV3Quote(
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: bigint
  ): Promise<{ buyAmount: bigint; feeTier: number; gasEstimate: bigint } | null> {
    if (!this.v3QuoteEnabled()) return null;

    let bestResult: { buyAmount: bigint; feeTier: number; gasEstimate: bigint } | null = null;

    for (const fee of V3_FEE_TIERS) {
      try {
        const callData = encodeFunctionData({
          abi: PANCAKESWAP_V3_QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{
            tokenIn,
            tokenOut,
            amountIn,
            fee,
            sqrtPriceLimitX96: 0n,
          }],
        });

        const result = await this.ethCall({
          to: this.v3QuoterAddress!,
          data: callData,
        });

        // Decode returns: (amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate)
        const decoded = decodeFunctionResult({
          abi: PANCAKESWAP_V3_QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          data: result,
        }) as readonly [bigint, bigint, number, bigint];

        const amountOut = decoded[0];
        const gasEstimate = decoded[3];

        if (!bestResult || amountOut > bestResult.buyAmount) {
          bestResult = { buyAmount: amountOut, feeTier: fee, gasEstimate };
        }
      } catch {
        // Fee tier not available, continue
        continue;
      }
    }

    return bestResult;
  }

  /**
   * Try V2 quote via getAmountsOut
   */
  private async tryV2Quote(
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    amountIn: bigint
  ): Promise<{ buyAmount: bigint } | null> {
    if (!this.v2QuoteEnabled()) return null;

    try {
      const path = [tokenIn, tokenOut] as const;
      const data = encodeFunctionData({
        abi: PANCAKESWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, [...path]],
      });

      const result = await this.ethCall({ to: this.config.v2RouterAddress!, data });

      const decoded = decodeFunctionResult({
        abi: PANCAKESWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        data: result,
      }) as readonly bigint[];

      const out = decoded[decoded.length - 1] ?? 0n;
      return out > 0n ? { buyAmount: out } : null;
    } catch {
      return null;
    }
  }

  getProviderMeta(): ProviderMeta {
    const v3Enabled = this.v3QuoteEnabled();
    const v2Enabled = this.v2QuoteEnabled();
    const version = v3Enabled && v2Enabled ? 'V3+V2' : v3Enabled ? 'V3' : v2Enabled ? 'V2' : 'none';
    
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
      integrationConfidence: v3Enabled ? 0.92 : v2Enabled ? 0.9 : 0.6,
      notes: this.quoteEnabled()
        ? `On-chain quote via ${version}. BuildTx enabled. Deep-link always available.`
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

    // Try V3 first (usually better prices), then fallback to V2
    const v3Result = await this.tryV3Quote(
      sellToken as `0x${string}`,
      buyToken as `0x${string}`,
      amountIn
    );

    const v2Result = await this.tryV2Quote(
      sellToken as `0x${string}`,
      buyToken as `0x${string}`,
      amountIn
    );

    // Pick the best quote (highest output)
    let bestBuyAmount = 0n;
    let usedVersion: 'v3' | 'v2' | null = null;
    let feeTier: number | null = null;
    let gasEstimate: bigint | null = null;

    if (v3Result && v3Result.buyAmount > bestBuyAmount) {
      bestBuyAmount = v3Result.buyAmount;
      usedVersion = 'v3';
      feeTier = v3Result.feeTier;
      gasEstimate = v3Result.gasEstimate;
    }

    if (v2Result && v2Result.buyAmount > bestBuyAmount) {
      bestBuyAmount = v2Result.buyAmount;
      usedVersion = 'v2';
      feeTier = null;
      gasEstimate = null;
    }

    if (bestBuyAmount === 0n || !usedVersion) {
      return {
        ...base,
        capabilities: { ...base.capabilities, quote: false },
        warnings: ['pancakeswap_no_liquidity'],
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

    // Store version info for buildTx to use
    const versionInfo = usedVersion === 'v3' && feeTier 
      ? [`pancakeswap_version:v3`, `pancakeswap_fee_tier:${feeTier}`]
      : [`pancakeswap_version:v2`];

    const raw = {
      sellAmount: request.sellAmount,
      buyAmount: bestBuyAmount.toString(),
      estimatedGas: gasEstimate ? Number(gasEstimate) : null,
      feeBps: feeTier ? Math.floor(feeTier / 100) : null, // Convert fee tier to bps (500 -> 5 bps)
      route: [sellToken, buyToken],
    };

    return {
      ...base,
      isStub: false,
      capabilities: { ...base.capabilities, quote: true },
      warnings: versionInfo,
      raw,
      normalized: normalizeQuoteFromRaw({ sellAmount: raw.sellAmount, buyAmount: raw.buyAmount }),
    };
  }

  async buildTx(request: QuoteRequest, quote: AdapterQuote): Promise<BuiltTx> {
    if (!this.buildTxEnabled()) {
      throw new Error('PancakeSwap buildTx not available: missing RPC or router config');
    }

    if (!quote.raw?.buyAmount || quote.raw.buyAmount === '0') {
      throw new Error('Cannot build tx: no valid quote available');
    }

    const sellTokenIsNative = this.isNativeToken(request.sellToken);
    const buyTokenIsNative = this.isNativeToken(request.buyToken);

    const sellToken = this.normalizeToken(request.sellToken) as `0x${string}`;
    const buyToken = this.normalizeToken(request.buyToken) as `0x${string}`;

    const amountIn = BigInt(request.sellAmount);
    const expectedOut = BigInt(quote.raw.buyAmount);
    // Apply slippage - use higher default (2%) for better success rate on BSC tokens
    const slippageBps = request.slippageBps ?? 200;
    const amountOutMin = expectedOut - (expectedOut * BigInt(slippageBps)) / 10000n;

    const to = request.account as `0x${string}`;

    // Extract version info from warnings
    const usedV3 = quote.warnings.some(w => w === 'pancakeswap_version:v3') && this.v3RouterAddress;
    const feeTierWarning = quote.warnings.find(w => w.startsWith('pancakeswap_fee_tier:'));
    const v3FeeTier = feeTierWarning ? parseInt(feeTierWarning.split(':')[1]!, 10) : undefined;

    let data: `0x${string}`;
    let value: string;
    let routerAddress: string;
    let gasLimit: string;

    if (usedV3 && v3FeeTier && !sellTokenIsNative && !buyTokenIsNative) {
      // V3: Token → Token via exactInputSingle
      routerAddress = this.v3RouterAddress!;
      data = encodeFunctionData({
        abi: PANCAKESWAP_V3_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: sellToken,
          tokenOut: buyToken,
          fee: v3FeeTier,
          recipient: to,
          amountIn,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: 0n,
        }],
      });
      value = '0';
      gasLimit = '300000';
    } else {
      // V2 fallback (also handles native tokens which V3 doesn't support directly)
      routerAddress = this.config.v2RouterAddress!;
      const path = [sellToken, buyToken] as `0x${string}`[];
      // Reasonable deadline for security (15 minutes - balances MEV risk vs success rate)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 900);

      // Use "SupportingFeeOnTransferTokens" methods by default
      // These work for ALL tokens (including those with taxes) and are safer on BSC
      if (sellTokenIsNative) {
        // BNB → Token: use swapExactETHForTokensSupportingFeeOnTransferTokens
        data = encodeFunctionData({
          abi: PANCAKESWAP_V2_ROUTER_ABI,
          functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
          args: [amountOutMin, path, to, deadline],
        });
        value = amountIn.toString();
      } else if (buyTokenIsNative) {
        // Token → BNB: use swapExactTokensForETHSupportingFeeOnTransferTokens
        data = encodeFunctionData({
          abi: PANCAKESWAP_V2_ROUTER_ABI,
          functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
          args: [amountIn, amountOutMin, path, to, deadline],
        });
        value = '0';
      } else {
        // Token → Token: use swapExactTokensForTokensSupportingFeeOnTransferTokens
        data = encodeFunctionData({
          abi: PANCAKESWAP_V2_ROUTER_ABI,
          functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
          args: [amountIn, amountOutMin, path, to, deadline],
        });
        value = '0';
      }
      gasLimit = '350000';
    }

    const result: BuiltTx = {
      to: routerAddress,
      data,
      value,
      gas: gasLimit,
    };

    // For ERC-20 tokens, user needs to approve the router first
    if (!sellTokenIsNative) {
      result.approvalAddress = routerAddress;
    }

    return result;
  }
}
