import { describe, expect, it, vi } from 'vitest';

import { decodeFunctionData, encodeFunctionResult } from 'viem';

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

  it('disables quoting on timeout (AbortController)', async () => {
    vi.useFakeTimers();

    const router = '0x1111111111111111111111111111111111111111';
    const sellToken = '0x2222222222222222222222222222222222222222';
    const buyToken = '0x3333333333333333333333333333333333333333';

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (!signal) {
          reject(new Error('missing_abort_signal'));
          return;
        }
        signal.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const adapter = new PancakeSwapDexAdapter({
      chainId: 56,
      rpcUrl: 'https://rpc.example.invalid',
      v2RouterAddress: router,
      quoteTimeoutMs: 5,
    });

    const quotePromise = adapter.getQuote({
      chainId: 56,
      sellToken,
      buyToken,
      sellAmount: '1000',
      slippageBps: 50,
    });

    await vi.advanceTimersByTimeAsync(10);
    const quote = await quotePromise;

    expect(quote.capabilities.quote).toBe(false);
    expect(quote.warnings.some((w) => w.startsWith('pancakeswap_quote_failed:'))).toBe(true);

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('maps native placeholder to WBNB in path', async () => {
    const router = '0x1111111111111111111111111111111111111111';
    const native = '0x0000000000000000000000000000000000000000';
    const wbnb = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    const buyToken = '0x3333333333333333333333333333333333333333';

    const mockedResult = encodeFunctionResult({
      abi: PANCAKESWAP_V2_ROUTER_ABI,
      functionName: 'getAmountsOut',
      result: [1000n, 5555n],
    });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method: string;
        params: Array<{ to: string; data: `0x${string}` }>;
      };

      expect(body.method).toBe('eth_call');
      const call = body.params[0];
      const decoded = decodeFunctionData({ abi: PANCAKESWAP_V2_ROUTER_ABI, data: call.data });
      expect(decoded.functionName).toBe('getAmountsOut');
      const args = decoded.args as readonly [bigint, readonly string[]];
      expect(args[1][0]!.toLowerCase()).toBe(wbnb.toLowerCase());
      expect(args[1][1]!.toLowerCase()).toBe(buyToken.toLowerCase());

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
      wbnb,
      quoteTimeoutMs: 2000,
    });

    const quote = await adapter.getQuote({
      chainId: 56,
      sellToken: native,
      buyToken,
      sellAmount: '1000',
      slippageBps: 50,
    });

    expect(quote.capabilities.quote).toBe(true);
    expect(quote.raw.buyAmount).toBe('5555');

    vi.unstubAllGlobals();
  });
});
