import { describe, expect, it } from 'vitest';

import { createServer } from '../src/server';

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

  it('GET /docs is available', async () => {
    const app = createServer({ logger: false });
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
