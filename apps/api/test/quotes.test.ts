import { describe, expect, it } from 'vitest';

import { createServer } from '../src/server';

describe('Option 1 API', () => {
  it('POST /v1/quotes is deterministic and stores receipt', async () => {
    const app = createServer({ logger: false });

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

    const receiptRes = await app.inject({
      method: 'GET',
      url: `/v1/receipts/${json1.receiptId}`,
    });

    expect(receiptRes.statusCode).toBe(200);
    expect(receiptRes.json().id).toBe(json1.receiptId);
  });

  it('GET /docs is available', async () => {
    const app = createServer({ logger: false });
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
