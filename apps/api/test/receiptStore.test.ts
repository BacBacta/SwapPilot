import { describe, expect, it } from 'vitest';

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DecisionReceipt } from '@swappilot/shared';

import { FileReceiptStore } from '../src/store/fileReceiptStore';
import { MemoryReceiptStore } from '../src/store/receiptStore';

const ZERO = '0x0000000000000000000000000000000000000000';

function makeReceipt(id: string): DecisionReceipt {
  return {
    id,
    createdAt: new Date(0).toISOString(),
    request: {
      chainId: 56,
      sellToken: ZERO,
      buyToken: ZERO,
      sellAmount: '1',
      slippageBps: 50,
      mode: 'NORMAL',
    },
    bestExecutableQuoteProviderId: null,
    bestRawOutputProviderId: null,
    beqRecommendedProviderId: null,
    rankedQuotes: [],
    bestRawQuotes: [],
    normalization: {
      assumptions: {
        priceModel: 'ratio_sell_buy',
        effectivePriceScale: 1_000_000,
        gasUsdPerTx: null,
        feeModel: 'feeBps_on_buyAmount',
      },
    },
    whyWinner: [],
    ranking: { mode: 'NORMAL', rationale: [] },
    warnings: [],
  };
}

describe('ReceiptStore', () => {
  it('MemoryReceiptStore put/get roundtrip', async () => {
    const store = new MemoryReceiptStore();
    const receipt = makeReceipt('rcpt_memory');

    await store.put(receipt);
    const got = await store.get(receipt.id);

    expect(got).toEqual(receipt);
    expect(await store.get('missing')).toBeNull();
  });

  it('FileReceiptStore put/get roundtrip', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'swappilot-receipts-'));
    try {
      const store = new FileReceiptStore(dir);
      const receipt = makeReceipt('rcpt_file');

      await store.put(receipt);
      const got = await store.get(receipt.id);

      expect(got).toEqual(receipt);
      expect(await store.get('missing')).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
