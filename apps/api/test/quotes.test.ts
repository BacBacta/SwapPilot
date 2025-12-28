import { describe, expect, it } from 'vitest';

import { createServer } from '../src/server';

function pad32(hexNo0x: string): string {
  return hexNo0x.padStart(64, '0');
}

function encodeUint256Array(values: bigint[]): `0x${string}` {
  // ABI encoding for a single return value uint256[]:
  // head: offset (0x20)
  // tail: length + values...
  const offset = pad32('20');
  const length = pad32(values.length.toString(16));
  const elems = values.map((v) => pad32(v.toString(16))).join('');
  return (`0x${offset}${length}${elems}`) as const;
}

type QuoteSummary = {
  providerId: string;
  signals?: {
    preflight?: unknown;
  };
};

type ReceiptSummary = {
  id: string;
  rankedQuotes: QuoteSummary[];
  bestRawQuotes: QuoteSummary[];
  beqRecommendedProviderId: string | null;
  whyWinner: unknown[];
  normalization?: {
    assumptions?: {
      priceModel?: string;
    };
  };
};

describe('Option 1 API', () => {
  it('POST /v1/quotes is deterministic and stores receipt', async () => {
    const app = createServer({
      logger: false,
      preflightClient: {
        async verify() {
          // Deterministic failure to exercise SAFE exclusion and receipts.
          return { ok: false, pRevert: 1, confidence: 1, reasons: ['mock_revert'] };
        },
      },
    });

    const body = {
      chainId: 56,
      sellToken: '0x0000000000000000000000000000000000000001',
      buyToken: '0x0000000000000000000000000000000000000002',
      sellAmount: '1000',
      slippageBps: 100,
      mode: 'NORMAL',
    };

    const res1 = await app.inject({ method: 'POST', url: '/v1/quotes', payload: body });
    const res2 = await app.inject({ method: 'POST', url: '/v1/quotes', payload: body });

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    const json1 = res1.json();
    const json2 = res2.json();

    expect(json1.receiptId).toBe(json2.receiptId);
    expect(json1.rankedQuotes).toHaveLength(7);
    expect(json2.rankedQuotes).toHaveLength(7);
    expect(json1.bestRawQuotes).toHaveLength(7);
    expect(json2.bestRawQuotes).toHaveLength(7);
    expect(typeof json1.beqRecommendedProviderId === 'string' || json1.beqRecommendedProviderId === null).toBe(true);

    const ids = json1.rankedQuotes.map((q: { providerId: string }) => q.providerId).sort();
    expect(ids).toEqual(
      ['1inch', 'binance-wallet', 'kyberswap', 'liquidmesh', 'metamask', 'okx-dex', 'pancakeswap'].sort(),
    );

    const rawIds = json1.bestRawQuotes.map((q: { providerId: string }) => q.providerId).sort();
    expect(rawIds).toEqual(
      ['1inch', 'binance-wallet', 'kyberswap', 'liquidmesh', 'metamask', 'okx-dex', 'pancakeswap'].sort(),
    );

    const receiptRes = await app.inject({
      method: 'GET',
      url: `/v1/receipts/${json1.receiptId}`,
    });

    expect(receiptRes.statusCode).toBe(200);
    const receipt = receiptRes.json() as ReceiptSummary;
    expect(receipt.id).toBe(json1.receiptId);
    expect(receipt.rankedQuotes).toHaveLength(7);
    expect(receipt.bestRawQuotes).toHaveLength(7);
    expect(typeof receipt.beqRecommendedProviderId === 'string' || receipt.beqRecommendedProviderId === null).toBe(true);
    expect(Array.isArray(receipt.whyWinner)).toBe(true);
    expect(receipt.normalization?.assumptions?.priceModel).toBe('ratio_sell_buy');

    // Preflight must be populated for at least one provider (mock txRequest path).
    const anyWithPreflight = receipt.rankedQuotes.some((q) => Boolean(q.signals?.preflight));
    expect(anyWithPreflight).toBe(true);
  });

  it('SAFE mode excludes preflight failures from BEQ ranking', async () => {
    const app = createServer({
      logger: false,
      preflightClient: {
        async verify() {
          return { ok: false, pRevert: 1, confidence: 1, reasons: ['mock_revert'] };
        },
      },
    });

    const body = {
      chainId: 56,
      sellToken: '0x0000000000000000000000000000000000000001',
      buyToken: '0x0000000000000000000000000000000000000002',
      sellAmount: '1000',
      slippageBps: 100,
      mode: 'SAFE',
    };

    const res = await app.inject({ method: 'POST', url: '/v1/quotes', payload: body });
    expect(res.statusCode).toBe(200);

    const json = res.json();
    // 1inch gets a mock txRequest => preflight fails => excluded in SAFE.
    const ids = (json.rankedQuotes as QuoteSummary[]).map((q) => q.providerId);
    expect(ids).not.toContain('1inch');
  });

  it('includes PancakeSwap as a real quote source when configured', async () => {
    const router = '0x1111111111111111111111111111111111111111';
    const sellToken = '0x2222222222222222222222222222222222222222';
    const buyToken = '0x3333333333333333333333333333333333333333';

    const fetchMock = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method: string };
      if (body.method !== 'eth_call') throw new Error('unexpected_rpc_method');
      return {
        async json() {
          return {
            jsonrpc: '2.0',
            id: 1,
            result: encodeUint256Array([1000n, 7777n]),
          };
        },
      } as unknown as Response;
    };

    // PancakeSwap adapter uses fetch for RPC.
    // Preflight is injected/mocked to avoid any other fetch usage.
    globalThis.fetch = fetchMock as typeof fetch;

    const app = createServer({
      logger: false,
      config: {
        nodeEnv: 'test',
        host: '0.0.0.0',
        port: 3001,
        receiptStore: { type: 'memory', path: '' },
        rpc: { bscUrls: ['https://rpc.example.invalid'], quorum: 2, timeoutMs: 2500, enableTrace: false },
        risk: { knownTokens: [], memeTokens: [] },
        pancakeswap: { v2Router: router, v3Quoter: null, wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', quoteTimeoutMs: 2000 },
      },
      preflightClient: {
        async verify() {
          return { ok: true, pRevert: 0, confidence: 1, reasons: ['mock_ok'] };
        },
      },
    });

    const body = {
      chainId: 56,
      sellToken,
      buyToken,
      sellAmount: '1000',
      slippageBps: 100,
      mode: 'NORMAL',
    };

    const res = await app.inject({ method: 'POST', url: '/v1/quotes', payload: body });
    expect(res.statusCode).toBe(200);

    const json = res.json() as { rankedQuotes: Array<{ providerId: string; capabilities: { quote: boolean }; raw: { buyAmount: string; route?: string[] } }> };
    const ps = json.rankedQuotes.find((q) => q.providerId === 'pancakeswap');
    expect(ps).toBeTruthy();
    expect(ps!.capabilities.quote).toBe(true);
    expect(ps!.raw.buyAmount).toBe('7777');
    expect(ps!.raw.route).toEqual([sellToken, buyToken]);
  });

  it('GET /docs is available', async () => {
    const app = createServer({ logger: false });
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
