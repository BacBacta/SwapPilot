import { describe, expect, it, vi } from 'vitest';

import { encodeFunctionResult } from 'viem';

import { PancakeSwapDexAdapter } from '../src/pancakeswapDexAdapter';

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

describe('PancakeSwapDexAdapter (v2)', () => {
  it('returns outAmount from mocked eth_call', async () => {
    const router = '0x1111111111111111111111111111111111111111';
    const sellToken = '0x2222222222222222222222222222222222222222';
    const buyToken = '0x3333333333333333333333333333333333333333';

    const mockedResult = encodeFunctionResult({
      abi: PANCAKESWAP_V2_ROUTER_ABI,
      functionName: 'getAmountsOut',
      result: [1000n, 1234n],
    });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method: string;
        params: unknown[];
      };

      expect(body.method).toBe('eth_call');
      expect(Array.isArray(body.params)).toBe(true);

      return {
        async json() {
          return { jsonrpc: '2.0', id: 1, result: mockedResult };
        },
      } as unknown as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = new PancakeSwapDexAdapter({
      chainId: 56,
      rpcUrl: 'https://rpc.example.invalid',
      v2RouterAddress: router,
      quoteTimeoutMs: 2000,
    });

    const quote = await adapter.getQuote({
      chainId: 56,
      sellToken,
      buyToken,
      sellAmount: '1000',
      slippageBps: 50,
    });

    expect(quote.capabilities.quote).toBe(true);
    expect(quote.isStub).toBe(false);
    expect(quote.raw.buyAmount).toBe('1234');
    expect(quote.raw.route).toEqual([sellToken, buyToken]);

    vi.unstubAllGlobals();
  });
});
