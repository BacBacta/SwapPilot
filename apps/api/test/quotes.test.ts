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
  it('POST /v1/quotes is deterministic and stores receipt', { timeout: 15_000 }, async () => {
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
    expect(json1.rankedQuotes).toHaveLength(13);
    expect(json2.rankedQuotes).toHaveLength(13);
    expect(json1.bestRawQuotes).toHaveLength(13);
    expect(json2.bestRawQuotes).toHaveLength(13);
    expect(typeof json1.beqRecommendedProviderId === 'string' || json1.beqRecommendedProviderId === null).toBe(true);

    const ids = json1.rankedQuotes.map((q: { providerId: string }) => q.providerId).sort();
    expect(ids).toEqual(
      ['0x', '1inch', 'binance-wallet', 'kyberswap', 'liquidmesh', 'metamask', 'odos', 'okx-dex', 'openocean', 'pancakeswap', 'paraswap', 'uniswap-v2', 'uniswap-v3'].sort(),
    );

    const rawIds = json1.bestRawQuotes.map((q: { providerId: string }) => q.providerId).sort();
    expect(rawIds).toEqual(
      ['0x', '1inch', 'binance-wallet', 'kyberswap', 'liquidmesh', 'metamask', 'odos', 'okx-dex', 'openocean', 'pancakeswap', 'paraswap', 'uniswap-v2', 'uniswap-v3'].sort(),
    );

    const receiptRes = await app.inject({
      method: 'GET',
      url: `/v1/receipts/${json1.receiptId}`,
    });

    expect(receiptRes.statusCode).toBe(200);
    const receipt = receiptRes.json() as ReceiptSummary;
    expect(receipt.id).toBe(json1.receiptId);
    expect(receipt.rankedQuotes).toHaveLength(13);
    expect(receipt.bestRawQuotes).toHaveLength(13);
    expect(typeof receipt.beqRecommendedProviderId === 'string' || receipt.beqRecommendedProviderId === null).toBe(true);
    expect(Array.isArray(receipt.whyWinner)).toBe(true);
    expect(receipt.normalization?.assumptions?.priceModel).toBe('ratio_sell_buy');

    // Preflight must be populated for at least one provider (mock txRequest path).
    const anyWithPreflight = receipt.rankedQuotes.some((q) => Boolean(q.signals?.preflight));
    expect(anyWithPreflight).toBe(true);
  });

  it('SAFE mode excludes preflight failures from BEQ ranking', { timeout: 15_000 }, async () => {
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
        redis: { url: null, quoteCacheTtlSeconds: 10 },
        rateLimit: { max: 1000, windowMs: 60_000 },
        metrics: { enabled: false },
        rpc: { bscUrls: ['https://rpc.example.invalid'], quorum: 2, timeoutMs: 2500, enableTrace: false },
        risk: { knownTokens: [], memeTokens: [] },
        pancakeswap: { v2Router: router, v3Quoter: null, v2Factory: '0x0000000000000000000000000000000000000000', v3Factory: '0x0000000000000000000000000000000000000000', wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', quoteTimeoutMs: 2000 },
        sellability: { multicall3Address: '0xcA11bde05977b3631167028862bE2a173976CA11', baseTokensBsc: [] },
        tokenSecurity: {
          enabled: false,
          goPlusEnabled: false,
          goPlusBaseUrl: 'https://api.gopluslabs.io/api/v1/token_security',
          honeypotIsEnabled: false,
          honeypotIsBaseUrl: 'https://api.honeypot.is/v2',
          timeoutMs: 1500,
          cacheTtlMs: 60_000,
          taxStrictMaxPercent: 20,
        },
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

  it('token security (honeypot) forces sellability FAIL', async () => {
    const fetchMock = async (url: string) => {
      if (url.startsWith('https://api.gopluslabs.io/api/v1/token_security/56')) {
        const addr = '0x00000000000000000000000000000000000000aa';
        return {
          ok: true,
          async json() {
            return {
              code: 1,
              message: 'OK',
              result: {
                [addr.toLowerCase()]: {
                  is_honeypot: '1',
                  cannot_sell_all: '1',
                  is_blacklisted: '0',
                  is_scam: '0',
                  buy_tax: '0',
                  sell_tax: '0',
                },
              },
            };
          },
        } as unknown as Response;
      }

      if (url.startsWith('https://api.honeypot.is/v2/IsHoneypot')) {
        return {
          ok: true,
          async json() {
            return {
              simulationSuccess: true,
              honeypotResult: { isHoneypot: true },
              simulationResult: { buyTax: 0, sellTax: 0, transferTax: 0 },
            };
          },
        } as unknown as Response;
      }

      throw new Error(`unexpected_fetch:${url}`);
    };

    globalThis.fetch = fetchMock as typeof fetch;

    const app = createServer({
      logger: false,
      config: {
        nodeEnv: 'test',
        host: '0.0.0.0',
        port: 3001,
        receiptStore: { type: 'memory', path: '' },
        redis: { url: null, quoteCacheTtlSeconds: 10 },
        rateLimit: { max: 1000, windowMs: 60_000 },
        metrics: { enabled: false },
        // Disable RPC/onchain sellability to keep this test focused and deterministic.
        rpc: { bscUrls: [], quorum: 2, timeoutMs: 2500, enableTrace: false },
        risk: { knownTokens: [], memeTokens: [] },
        pancakeswap: {
          v2Router: null,
          v3Quoter: null,
          v2Factory: '0x0000000000000000000000000000000000000000',
          v3Factory: '0x0000000000000000000000000000000000000000',
          wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          quoteTimeoutMs: 2000,
        },
        sellability: { multicall3Address: '0xcA11bde05977b3631167028862bE2a173976CA11', baseTokensBsc: [] },
        tokenSecurity: {
          enabled: true,
          goPlusEnabled: true,
          goPlusBaseUrl: 'https://api.gopluslabs.io',
          honeypotIsEnabled: true,
          honeypotIsBaseUrl: 'https://api.honeypot.is',
          timeoutMs: 800,
          cacheTtlMs: 60_000,
          taxStrictMaxPercent: 5,
        },
      },
      preflightClient: {
        async verify() {
          return { ok: true, pRevert: 0, confidence: 1, reasons: ['mock_ok'] };
        },
      },
    });

    const body = {
      chainId: 56,
      sellToken: '0x0000000000000000000000000000000000000001',
      buyToken: '0x00000000000000000000000000000000000000aa',
      sellAmount: '1000',
      slippageBps: 100,
      mode: 'NORMAL',
    };

    const res = await app.inject({ method: 'POST', url: '/v1/quotes', payload: body });
    expect(res.statusCode).toBe(200);
    const json = res.json() as any;

    const anyFail = (json.rankedQuotes as any[]).some((q) => q.signals?.sellability?.status === 'FAIL');
    expect(anyFail).toBe(true);

    const failing = (json.rankedQuotes as any[]).find((q) => q.signals?.sellability?.status === 'FAIL');
    expect(failing.signals.sellability.reasons.join(' ')).toContain('token_security:goplus:is_honeypot');
    expect(failing.signals.sellability.reasons.join(' ')).toContain('token_security:honeypotis:is_honeypot');
  });
});
