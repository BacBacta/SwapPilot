import { z } from 'zod';

/**
 * Zod schemas for validating external API responses
 * 
 * Security: Replaces unsafe `as` type assertions with runtime validation
 * to prevent injection attacks and type confusion vulnerabilities.
 */

// Common fields across DEX aggregators
export const BaseQuoteResponseSchema = z.object({
  sellAmount: z.string(),
  buyAmount: z.string(),
  estimatedGas: z.string().optional().nullable(),
  gas: z.string().optional(),
  gasPrice: z.string().optional(),
  value: z.string().optional(),
  to: z.string().optional(),
  data: z.string().optional(),
  from: z.string().optional(),
});

// 1inch API response
export const OneInchQuoteSchema = z.object({
  dstAmount: z.string(),
  srcAmount: z.string(),
  toTokenAmount: z.string(),
  fromTokenAmount: z.string(),
  protocols: z.array(z.any()).optional(),
  tx: z.object({
    from: z.string(),
    to: z.string(),
    data: z.string(),
    value: z.string(),
    gas: z.union([z.string(), z.number()]).optional(),
    gasPrice: z.string().optional(),
  }).optional(),
});

// 0x API response
export const ZeroXQuoteSchema = z.object({
  sellAmount: z.string(),
  buyAmount: z.string(),
  price: z.string().optional(),
  estimatedGas: z.string().optional(),
  gas: z.string().optional(),
  gasPrice: z.string().optional(),
  to: z.string(),
  data: z.string(),
  value: z.string(),
  allowanceTarget: z.string().optional(),
});

// Odos API response
export const OdosQuoteSchema = z.object({
  inTokens: z.array(z.string()),
  outTokens: z.array(z.string()),
  inAmounts: z.array(z.string()),
  outAmounts: z.array(z.string()),
  gasEstimate: z.number().optional(),
  pathId: z.string().optional(),
});

export const OdosAssembleSchema = z.object({
  transaction: z.object({
    gas: z.number().optional(),
    gasPrice: z.number().optional(),
    value: z.string(),
    to: z.string(),
    data: z.string(),
    from: z.string().optional(),
  }),
  inputTokens: z.array(z.object({
    tokenAddress: z.string(),
    amount: z.string(),
  })).optional(),
  outputTokens: z.array(z.object({
    tokenAddress: z.string(),
    amount: z.string(),
  })).optional(),
});

// ParaSwap API response
export const ParaSwapPriceSchema = z.object({
  priceRoute: z.object({
    srcToken: z.string().optional(),
    destToken: z.string().optional(),
    srcAmount: z.string(),
    destAmount: z.string(),
    bestRoute: z.array(z.any()).optional(),
    gasCost: z.string().optional(),
    gasCostUSD: z.string().optional(),
  }),
});

export const ParaSwapTxSchema = z.object({
  from: z.string(),
  to: z.string(),
  value: z.string(),
  data: z.string(),
  gasPrice: z.string().optional(),
  gas: z.string().optional(),
  chainId: z.number().optional(),
});

// OKX DEX API response (quote endpoint - simple format)
export const OkxQuoteSchema = z.object({
  code: z.string(),
  msg: z.string().optional(),
  data: z.array(z.object({
    routerResult: z.object({
      fromTokenAmount: z.string(),
      toTokenAmount: z.string(),
      estimateGasFee: z.string().optional(),
    }).optional(),
    toTokenAmount: z.string().optional(),
    estimateGasFee: z.string().optional(),
    tx: z.object({
      from: z.string(),
      to: z.string(),
      data: z.string(),
      value: z.string(),
      gas: z.string().optional(),
      gasPrice: z.string().optional(),
    }).optional(),
    quoteCompareList: z.array(z.object({
      dexName: z.string().optional(),
      tradeFee: z.string().optional(),
    })).optional(),
    approvalAddress: z.string().optional(),
    approveTo: z.string().optional(),
    tokenApproveAddress: z.string().optional(),
    spender: z.string().optional(),
    dexContractAddress: z.string().optional(),
  })),
});

// OKX DEX API response (swap/buildTx endpoint)
export const OkxSwapSchema = z.object({
  code: z.string(),
  msg: z.string().optional(),
  data: z.array(z.object({
    tx: z.object({
      to: z.string().optional(),
      data: z.string().optional(),
      value: z.string().optional(),
      gas: z.union([z.string(), z.number()]).optional(),
      gasPrice: z.union([z.string(), z.number()]).optional(),
    }).optional(),
    transaction: z.object({
      to: z.string().optional(),
      data: z.string().optional(),
      value: z.string().optional(),
      gas: z.union([z.string(), z.number()]).optional(),
      gasPrice: z.union([z.string(), z.number()]).optional(),
    }).optional(),
    routerResult: z.object({
      toTokenApproveContractAddress: z.string().optional(),
      fromTokenApproveAddress: z.string().optional(),
      dexContractAddress: z.string().optional(),
    }).optional(),
    approvalAddress: z.string().optional(),
    approveTo: z.string().optional(),
    tokenApproveAddress: z.string().optional(),
    spender: z.string().optional(),
    dexContractAddress: z.string().optional(),
  })),
});

// 1inch swap (buildTx) response
export const OneInchSwapResponseSchema = z.object({
  tx: z.object({
    to: z.string(),
    data: z.string(),
    value: z.string(),
    gas: z.union([z.string(), z.number()]).optional(),
    gasPrice: z.string().optional(),
  }),
});

// KyberSwap API response (wrapper structure)
export const KyberSwapQuoteSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: z.object({
    routeSummary: z.object({
      tokenIn: z.string(),
      tokenOut: z.string(),
      amountIn: z.string(),
      amountOut: z.string(),
      amountOutUsd: z.string().optional(),
      gas: z.string().optional(),
      gasUsd: z.string().optional(),
      route: z.array(z.any()).optional(),
    }),
    routerAddress: z.string().optional(),
  }).optional(),
});

export const KyberSwapBuildTxSchema = z.object({
  data: z.string(),
  routerAddress: z.string().optional(),
  amountIn: z.string(),
  amountInUsd: z.string().optional(),
  amountOut: z.string(),
  amountOutUsd: z.string().optional(),
  gas: z.string().optional(),
  gasUsd: z.string().optional(),
});

// OpenOcean API response
export const OpenOceanQuoteSchema = z.object({
  code: z.number(),
  data: z.object({
    inAmount: z.string(),
    outAmount: z.string(),
    estimatedGas: z.string().optional(),
    path: z.object({
      routes: z.array(z.any()).optional(),
    }).optional(),
  }),
});

export const OpenOceanSwapSchema = z.object({
  code: z.number(),
  data: z.object({
    from: z.string(),
    to: z.string(),
    data: z.string(),
    value: z.string(),
    gasPrice: z.string().optional(),
    gas: z.string().optional(),
    minOutAmount: z.string().optional(),
    inAmount: z.string(),
    outAmount: z.string(),
  }),
});

// Thena/Ramses DEX response
export const ThenaQuoteSchema = z.object({
  amountIn: z.string(),
  amountOut: z.string(),
  route: z.array(z.object({
    from: z.string(),
    to: z.string(),
    stable: z.boolean(),
  })).optional(),
});

// Generic RPC response for on-chain calls (Uniswap, PancakeSwap, etc.)
export const RpcResponseSchema = z.object({
  jsonrpc: z.string(),
  id: z.union([z.number(), z.string()]),
  result: z.union([z.string(), z.array(z.string())]).optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional(),
  }).optional(),
});

/**
 * Safe parse helper with type narrowing
 * Returns parsed data or throws descriptive error
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`${context} validation failed: ${errors}`);
  }
  
  return result.data;
}

/**
 * Safe JSON parse with schema validation
 * Prevents JSON injection attacks and prototype pollution
 */
export async function safeJsonParse<T>(
  response: Response,
  schema: z.ZodSchema<T>,
  context: string
): Promise<T> {
  const text = await response.text();
  
  // Check for __proto__ as a JSON key (must be quoted in JSON)
  // This is more precise than checking for substrings
  if (/"__proto__"\s*:/.test(text)) {
    throw new Error(`${context}: Potential prototype pollution detected (__proto__ key)`);
  }
  
  let json: unknown;
  try {
    // Use a reviver function to strip dangerous keys during parsing
    json = JSON.parse(text, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
  } catch (err) {
    throw new Error(`${context}: Invalid JSON - ${err}`);
  }
  
  return safeParse(schema, json, context);
}
