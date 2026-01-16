import type { RiskSignals } from '@swappilot/shared';

import { RpcClient, type HexString } from '@swappilot/preflight';

import { decodeFunctionResult, encodeFunctionData, isAddress, zeroAddress, type Hex } from 'viem';

const NATIVE_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const;
const SEL_DECIMALS = '0x313ce567' as const;

const MULTICALL3_DEFAULT = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

// PancakeSwap official addresses (BSC mainnet) from developer.pancakeswap.finance
const PCS_V2_FACTORY_BSC = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as const;
const PCS_V3_FACTORY_BSC = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as const;

// Minimum liquidity thresholds (in base token units, 18 decimals)
// For WBNB at ~$600, 100$ minimum = 0.17 WBNB = 1.7e17 wei
// We use a conservative threshold of 0.05 WBNB (~$30) to catch dust liquidity
const MIN_LIQUIDITY_THRESHOLD = 50_000_000_000_000_000n; // 0.05 base token (e.g., WBNB)

// For V3, liquidity is a different scale - use a minimum of 1e15
const MIN_V3_LIQUIDITY_THRESHOLD = 1_000_000_000_000_000n;

const MULTICALL3_ABI = [
  {
    type: 'function',
    name: 'aggregate3',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const;

const V2_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPair',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
] as const;

const V3_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

const V2_PAIR_ABI = [
  {
    type: 'function',
    name: 'getReserves',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'token0',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'token0', type: 'address' }],
  },
] as const;

const V3_POOL_ABI = [
  {
    type: 'function',
    name: 'liquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
] as const;

type Call3 = { target: `0x${string}`; allowFailure: boolean; callData: Hex };
type Result3 = { success: boolean; returnData: Hex };

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

async function rpcBestEffort<T>(params: {
  urls: string[];
  timeoutMs: number;
  fn: (client: RpcClient) => Promise<T>;
}): Promise<T> {
  let lastErr: unknown = null;
  for (const url of params.urls) {
    try {
      const client = new RpcClient(url, params.timeoutMs);
      return await params.fn(client);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('rpc_all_failed');
}

async function multicallAggregate3(params: {
  rpcUrls: string[];
  timeoutMs: number;
  multicall3Address: `0x${string}`;
  calls: Call3[];
}): Promise<Result3[]> {
  const data = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [params.calls],
  });

  const raw = await rpcBestEffort({
    urls: params.rpcUrls,
    timeoutMs: params.timeoutMs,
    fn: (c) => c.call({ to: params.multicall3Address, data } as unknown),
  });

  const decoded = decodeFunctionResult({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    data: raw as Hex,
  }) as Result3[];

  return decoded;
}

export async function assessOnchainSellability(params: {
  chainId: number;
  buyToken: string;
  rpcUrls: string[];
  timeoutMs: number;
  multicall3Address: string | null;
  baseTokens: string[] | null;
  pancake: { v2Factory: string; v3Factory: string; wbnb: string } | null;
}): Promise<RiskSignals['sellability']> {
  // BSC-only for now; keep it safe.
  if (params.chainId !== 56) {
    return { status: 'UNCERTAIN', confidence: 0.2, reasons: ['onchain_sellability:unsupported_chain'] };
  }

  const token = params.buyToken;
  if (normalizeAddress(token) === normalizeAddress(NATIVE_SENTINEL)) {
    return { status: 'OK', confidence: 0.9, reasons: ['native_asset'] };
  }

  const multicall3Raw = (params.multicall3Address ?? '').trim();
  const v2FactoryRaw = (params.pancake?.v2Factory ?? '').trim();
  const v3FactoryRaw = (params.pancake?.v3Factory ?? '').trim();

  const multicall3Address = (multicall3Raw.length > 0 ? multicall3Raw : MULTICALL3_DEFAULT) as `0x${string}`;
  const v2Factory = (v2FactoryRaw.length > 0 ? v2FactoryRaw : PCS_V2_FACTORY_BSC) as `0x${string}`;
  const v3Factory = (v3FactoryRaw.length > 0 ? v3FactoryRaw : PCS_V3_FACTORY_BSC) as `0x${string}`;

  const baseTokens = (params.baseTokens && params.baseTokens.length > 0 ? params.baseTokens : [params.pancake?.wbnb ?? ''])
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (!isAddress(token)) {
    return { status: 'FAIL', confidence: 1, reasons: ['onchain_sellability:invalid_address'] };
  }

  if (!isAddress(multicall3Address)) {
    return { status: 'UNCERTAIN', confidence: 0.2, reasons: ['onchain_sellability:invalid_multicall_address'] };
  }

  // If token is itself a base, treat as sellable.
  if (baseTokens.some((b) => normalizeAddress(b) === normalizeAddress(token))) {
    return { status: 'OK', confidence: 0.85, reasons: ['onchain_sellability:base_token'] };
  }

  // If no RPC configured, don't block.
  if (!params.rpcUrls || params.rpcUrls.length === 0) {
    return { status: 'UNCERTAIN', confidence: 0.2, reasons: ['onchain_sellability:rpc_not_configured'] };
  }

  try {
    // 1) Contract code must exist.
    const code = await rpcBestEffort({
      urls: params.rpcUrls,
      timeoutMs: params.timeoutMs,
      fn: (c) => c.request<HexString>('eth_getCode', [token, 'latest']),
    });

    if (code === '0x') {
      return { status: 'FAIL', confidence: 1, reasons: ['onchain_sellability:no_contract_code'] };
    }

    // 2) Must respond to decimals() as a basic ERC20 sanity check.
    // We don't fully decode the value here, just require the call to succeed.
    try {
      await rpcBestEffort({
        urls: params.rpcUrls,
        timeoutMs: params.timeoutMs,
        fn: (c) => c.call({ to: token, data: SEL_DECIMALS } as unknown),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        status: 'FAIL',
        confidence: 0.9,
        reasons: ['onchain_sellability:decimals_call_failed', `rpc:${msg}`],
      };
    }

    const reasons: string[] = ['onchain_sellability:erc20_decimals_ok'];

    // 3) PancakeSwap V2/V3 liquidity checks via Multicall3
    const bases = baseTokens.filter((b) => isAddress(b));
    if (bases.length === 0) {
      return { status: 'UNCERTAIN', confidence: clamp01(0.45), reasons: [...reasons, 'onchain_sellability:no_bases_configured'] };
    }

    const feeTiers: number[] = [500, 2500, 10000];

    const stage1Calls: Call3[] = [];
    const stage1Keys: Array<{ kind: 'v2pair'; base: string } | { kind: 'v3pool'; base: string; fee: number }> = [];

    if (isAddress(v2Factory)) {
      for (const base of bases) {
        stage1Calls.push({
          target: v2Factory,
          allowFailure: true,
          callData: encodeFunctionData({
            abi: V2_FACTORY_ABI,
            functionName: 'getPair',
            args: [token as `0x${string}`, base as `0x${string}`],
          }),
        });
        stage1Keys.push({ kind: 'v2pair', base });
      }
    } else {
      reasons.push('onchain_sellability:invalid_pcs_v2_factory');
    }

    if (isAddress(v3Factory)) {
      for (const base of bases) {
        for (const fee of feeTiers) {
          stage1Calls.push({
            target: v3Factory,
            allowFailure: true,
            callData: encodeFunctionData({
              abi: V3_FACTORY_ABI,
              functionName: 'getPool',
              args: [token as `0x${string}`, base as `0x${string}`, fee],
            }),
          });
          stage1Keys.push({ kind: 'v3pool', base, fee });
        }
      }
    } else {
      reasons.push('onchain_sellability:invalid_pcs_v3_factory');
    }

    if (stage1Calls.length === 0) {
      return { status: 'UNCERTAIN', confidence: clamp01(0.45), reasons: [...reasons, 'onchain_sellability:no_pcs_checks_enabled'] };
    }

    const stage1 = await multicallAggregate3({
      rpcUrls: params.rpcUrls,
      timeoutMs: params.timeoutMs,
      multicall3Address,
      calls: stage1Calls,
    });

    const v2Pairs: Array<{ base: string; pair: string }> = [];
    const v3Pools: Array<{ base: string; fee: number; pool: string }> = [];

    for (let i = 0; i < stage1.length; i++) {
      const res = stage1[i];
      const key = stage1Keys[i];
      if (!res || !key) continue;
      if (!res.success) continue;

      try {
        if (key.kind === 'v2pair') {
          const pair = decodeFunctionResult({
            abi: V2_FACTORY_ABI,
            functionName: 'getPair',
            data: res.returnData,
          }) as `0x${string}`;
          if (pair && pair !== zeroAddress) v2Pairs.push({ base: key.base, pair });
        } else {
          const pool = decodeFunctionResult({
            abi: V3_FACTORY_ABI,
            functionName: 'getPool',
            data: res.returnData,
          }) as `0x${string}`;
          if (pool && pool !== zeroAddress) v3Pools.push({ base: key.base, fee: key.fee, pool });
        }
      } catch {
        // ignore per-call decode issues
      }
    }

    if (v2Pairs.length === 0 && v3Pools.length === 0) {
      return {
        status: 'UNCERTAIN',
        confidence: clamp01(0.5),
        reasons: [...reasons, 'onchain_sellability:pcs:no_pair_or_pool'],
      };
    }

    const stage2Calls: Call3[] = [];
    const stage2Keys: Array<
      | { kind: 'v2_reserves'; base: string; pair: string }
      | { kind: 'v2_token0'; base: string; pair: string }
      | { kind: 'v3_liquidity'; base: string; fee: number; pool: string }
    > = [];

    for (const p of v2Pairs) {
      stage2Calls.push({
        target: p.pair as `0x${string}`,
        allowFailure: true,
        callData: encodeFunctionData({ abi: V2_PAIR_ABI, functionName: 'getReserves', args: [] }),
      });
      stage2Keys.push({ kind: 'v2_reserves', base: p.base, pair: p.pair });

      stage2Calls.push({
        target: p.pair as `0x${string}`,
        allowFailure: true,
        callData: encodeFunctionData({ abi: V2_PAIR_ABI, functionName: 'token0', args: [] }),
      });
      stage2Keys.push({ kind: 'v2_token0', base: p.base, pair: p.pair });
    }

    for (const p of v3Pools) {
      stage2Calls.push({
        target: p.pool as `0x${string}`,
        allowFailure: true,
        callData: encodeFunctionData({ abi: V3_POOL_ABI, functionName: 'liquidity', args: [] }),
      });
      stage2Keys.push({ kind: 'v3_liquidity', base: p.base, fee: p.fee, pool: p.pool });
    }

    const stage2 = await multicallAggregate3({
      rpcUrls: params.rpcUrls,
      timeoutMs: params.timeoutMs,
      multicall3Address,
      calls: stage2Calls,
    });

    const v2ByPair = new Map<
      string,
      { base: string; reserves?: { r0: bigint; r1: bigint }; token0?: string }
    >();
    const v3ByPool = new Map<string, { base: string; fee: number; liquidity?: bigint }>();

    for (let i = 0; i < stage2.length; i++) {
      const res = stage2[i];
      const key = stage2Keys[i];
      if (!res || !key) continue;
      if (!res.success) continue;

      try {
        if (key.kind === 'v2_reserves') {
          const decoded = decodeFunctionResult({
            abi: V2_PAIR_ABI,
            functionName: 'getReserves',
            data: res.returnData,
          }) as readonly [bigint, bigint, number];
          const r0 = decoded[0] ?? 0n;
          const r1 = decoded[1] ?? 0n;
          const cur = v2ByPair.get(key.pair) ?? { base: key.base };
          v2ByPair.set(key.pair, { ...cur, base: key.base, reserves: { r0, r1 } });
        } else if (key.kind === 'v2_token0') {
          const t0 = decodeFunctionResult({
            abi: V2_PAIR_ABI,
            functionName: 'token0',
            data: res.returnData,
          }) as `0x${string}`;
          const cur = v2ByPair.get(key.pair) ?? { base: key.base };
          v2ByPair.set(key.pair, { ...cur, base: key.base, token0: t0 });
        } else {
          const liq = decodeFunctionResult({
            abi: V3_POOL_ABI,
            functionName: 'liquidity',
            data: res.returnData,
          }) as bigint;
          v3ByPool.set(key.pool, { base: key.base, fee: key.fee, liquidity: liq });
        }
      } catch {
        // ignore per-call decode issues
      }
    }

    const okBases = new Set<string>();
    const lowLiquidityBases = new Set<string>();

    for (const [, v] of v2ByPair) {
      if (!v.reserves || !v.token0) continue;
      if (v.reserves.r0 > 0n && v.reserves.r1 > 0n) {
        // Determine which reserve is the base token
        const isToken0Base = normalizeAddress(v.token0) === normalizeAddress(v.base);
        const baseReserve = isToken0Base ? v.reserves.r0 : v.reserves.r1;
        
        // Check if base token reserve meets minimum threshold
        if (baseReserve >= MIN_LIQUIDITY_THRESHOLD) {
          okBases.add(v.base);
        } else {
          // Liquidity exists but is below minimum threshold (dust liquidity)
          lowLiquidityBases.add(v.base);
        }
      }
    }

    for (const [, v] of v3ByPool) {
      if (typeof v.liquidity === 'bigint' && v.liquidity > 0n) {
        // Check if V3 liquidity meets minimum threshold
        if (v.liquidity >= MIN_V3_LIQUIDITY_THRESHOLD) {
          okBases.add(v.base);
        } else {
          lowLiquidityBases.add(v.base);
        }
      }
    }

    if (okBases.size > 0) {
      for (const b of okBases) reasons.push(`onchain_sellability:pcs_liquidity_ok:${normalizeAddress(b)}`);
      const conf = clamp01(0.72 + Math.min(0.18, okBases.size * 0.04));
      return { status: 'OK', confidence: conf, reasons };
    }

    // Pairs/pools exist but liquidity is below minimum threshold
    if (lowLiquidityBases.size > 0) {
      for (const b of lowLiquidityBases) reasons.push(`onchain_sellability:pcs_low_liquidity:${normalizeAddress(b)}`);
      reasons.push('onchain_sellability:liquidity_below_minimum_threshold');
      return { status: 'FAIL', confidence: clamp01(0.75), reasons };
    }

    // If pairs/pools exist but liquidity looks empty, keep it uncertain (could still be sellable elsewhere).
    reasons.push('onchain_sellability:pcs:pair_or_pool_exists_but_zero_liquidity');
    return { status: 'UNCERTAIN', confidence: clamp01(0.58), reasons };
    return { status: 'UNCERTAIN', confidence: clamp01(0.58), reasons };
  } catch (e) {
    // Best-effort: never crash scoring; just mark uncertain.
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 'UNCERTAIN', confidence: 0.15, reasons: ['onchain_sellability:error', `rpc:${msg}`] };
  }
}
