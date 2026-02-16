import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { encodeFunctionData, encodeFunctionResult, decodeFunctionData, type Hex } from 'viem';

import { assessOnchainSellability } from '../src/risk/onchainSellability';

// Type for multicall3 aggregate3 result tuples.
type Result3 = { success: boolean; returnData: Hex };

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;
const PCS_V2_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73' as const;
const PCS_V3_FACTORY = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as const;

const TOKEN = '0x1111111111111111111111111111111111111111' as const;
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const;
const USDT = '0x55d398326f99059fF775485246999027B3197955' as const;

const PAIR = '0x2222222222222222222222222222222222222222' as const;
const POOL = '0x3333333333333333333333333333333333333333' as const;

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

function jsonRpcResult(result: unknown) {
  return {
    async json() {
      return { jsonrpc: '2.0', id: 1, result };
    },
  } as unknown as Response;
}

describe('assessOnchainSellability (PCS V2/V3, multicall)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method: string;
        params?: unknown[];
      };

      if (body.method === 'eth_getCode') {
        return jsonRpcResult('0x1234');
      }

      if (body.method !== 'eth_call') throw new Error('unexpected_rpc_method');

      const params = (body.params ?? []) as unknown[];
      const tx = params[0] as { to?: string; data?: string };
      const to = String(tx.to ?? '').toLowerCase();
      const data = String(tx.data ?? '0x') as Hex;

      // decimals()
      if (to === TOKEN.toLowerCase() && data.startsWith('0x313ce567')) {
        // uint256(18)
        return jsonRpcResult(('0x' + '0'.repeat(63) + '12') as Hex);
      }

      // multicall stage
      if (to === MULTICALL3_ADDRESS.toLowerCase()) {
        const decoded = decodeFunctionData({ abi: MULTICALL3_ABI, data });
        const calls = (decoded.args?.[0] ?? []) as Array<{ target: string; allowFailure: boolean; callData: Hex }>;

        const results: Result3[] = calls.map((c) => {
          const target = c.target.toLowerCase();
          const cd = c.callData;

          // V2 factory getPair
          if (target === PCS_V2_FACTORY.toLowerCase()) {
            try {
              const d = decodeFunctionData({ abi: V2_FACTORY_ABI, data: cd });
              const [, tokenB] = d.args as [string, string];
              const pair = tokenB.toLowerCase() === WBNB.toLowerCase() ? PAIR : ('0x0000000000000000000000000000000000000000' as const);
              const returnData = encodeFunctionResult({
                abi: V2_FACTORY_ABI,
                functionName: 'getPair',
                result: pair,
              });
              return { success: true, returnData };
            } catch {
              return { success: false, returnData: '0x' as Hex };
            }
          }

          // V3 factory getPool
          if (target === PCS_V3_FACTORY.toLowerCase()) {
            try {
              const d = decodeFunctionData({ abi: V3_FACTORY_ABI, data: cd });
              const [, tokenB, fee] = d.args as [string, string, number];
              const pool = tokenB.toLowerCase() === WBNB.toLowerCase() && fee === 2500 ? POOL : ('0x0000000000000000000000000000000000000000' as const);
              const returnData = encodeFunctionResult({
                abi: V3_FACTORY_ABI,
                functionName: 'getPool',
                result: pool,
              });
              return { success: true, returnData };
            } catch {
              return { success: false, returnData: '0x' as Hex };
            }
          }

          // V2 pair methods
          if (target === PAIR.toLowerCase()) {
            // getReserves
            if (cd.startsWith(encodeFunctionData({ abi: V2_PAIR_ABI, functionName: 'getReserves', args: [] }).slice(0, 10))) {
              const returnData = encodeFunctionResult({
                abi: V2_PAIR_ABI,
                functionName: 'getReserves',
                // Use non-dust reserves so sellability can be OK under MIN_LIQUIDITY_THRESHOLD.
                result: [100_000_000_000_000_000n, 200_000_000_000_000_000n, 1] as const,
              });
              return { success: true, returnData };
            }

            // token0
            if (cd.startsWith(encodeFunctionData({ abi: V2_PAIR_ABI, functionName: 'token0', args: [] }).slice(0, 10))) {
              const returnData = encodeFunctionResult({
                abi: V2_PAIR_ABI,
                functionName: 'token0',
                result: TOKEN,
              });
              return { success: true, returnData };
            }
          }

          // V3 pool methods
          if (target === POOL.toLowerCase()) {
            if (cd.startsWith(encodeFunctionData({ abi: V3_POOL_ABI, functionName: 'liquidity', args: [] }).slice(0, 10))) {
              const returnData = encodeFunctionResult({
                abi: V3_POOL_ABI,
                functionName: 'liquidity',
                // Meet MIN_V3_LIQUIDITY_THRESHOLD.
                result: 2_000_000_000_000_000n,
              });
              return { success: true, returnData };
            }
          }

          return { success: false, returnData: '0x' as Hex };
        });

        const aggregateData = encodeFunctionResult({
          abi: MULTICALL3_ABI,
          functionName: 'aggregate3',
          result: results,
        });

        return jsonRpcResult(aggregateData);
      }

      return jsonRpcResult('0x');
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns OK when PCS V2 reserves or V3 liquidity is present', async () => {
    const out = await assessOnchainSellability({
      chainId: 56,
      buyToken: TOKEN,
      rpcUrls: ['http://fake-rpc.local'],
      timeoutMs: 1000,
      multicall3Address: MULTICALL3_ADDRESS,
      baseTokens: [WBNB, USDT],
      pancake: { v2Factory: PCS_V2_FACTORY, v3Factory: PCS_V3_FACTORY, wbnb: WBNB },
    });

    expect(out.status).toBe('OK');
    expect(out.confidence).toBeGreaterThan(0.6);
    expect(out.reasons.join('|')).toContain('onchain_sellability:erc20_decimals_ok');
    expect(out.reasons.join('|')).toContain('onchain_sellability:pcs_liquidity_ok');
  });

  it('returns FAIL when token has no contract code', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method: string };
      if (body.method === 'eth_getCode') return jsonRpcResult('0x');
      return jsonRpcResult('0x');
    }) as typeof fetch;

    const out = await assessOnchainSellability({
      chainId: 56,
      buyToken: TOKEN,
      rpcUrls: ['http://fake-rpc.local'],
      timeoutMs: 1000,
      multicall3Address: MULTICALL3_ADDRESS,
      baseTokens: [WBNB],
      pancake: { v2Factory: PCS_V2_FACTORY, v3Factory: PCS_V3_FACTORY, wbnb: WBNB },
    });

    expect(out.status).toBe('FAIL');
    expect(out.reasons).toContain('onchain_sellability:no_contract_code');

    globalThis.fetch = original;
  });
});
