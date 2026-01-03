import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { createServer } from '../src/server';

function pad32(hexNo0x: string): string {
  return hexNo0x.padStart(64, '0');
}

function encodeUint256(value: bigint): `0x${string}` {
  return (`0x${pad32(value.toString(16))}`) as `0x${string}`;
}

function encodeAbiString(value: string): `0x${string}` {
  const bytes = new TextEncoder().encode(value);
  const len = bytes.length;

  const headOffset = pad32((32).toString(16));
  const headLen = pad32(len.toString(16));

  const dataHex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const paddedDataHex = dataHex.padEnd(Math.ceil(len / 32) * 64, '0');
  return (`0x${headOffset}${headLen}${paddedDataHex}`) as `0x${string}`;
}

const SEL_DECIMALS = '0x313ce567';
const SEL_SYMBOL = '0x95d89b41';
const SEL_NAME = '0x06fdde03';

describe('GET /v1/tokens/resolve', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        method: string;
        params?: unknown[];
      };

      if (body.method !== 'eth_call') throw new Error('unexpected_rpc_method');
      const params = (body.params ?? []) as unknown[];
      const tx = params[0] as { to?: string; data?: string };
      const data = String(tx.data ?? '0x');

      let result: `0x${string}` = '0x';
      if (data.startsWith(SEL_DECIMALS)) result = encodeUint256(18n);
      else if (data.startsWith(SEL_SYMBOL)) result = encodeAbiString('TKN');
      else if (data.startsWith(SEL_NAME)) result = encodeAbiString('Test Token');

      return {
        async json() {
          return { jsonrpc: '2.0', id: 1, result };
        },
      } as unknown as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns decimals/symbol/name for ERC20 address', async () => {
    const app = createServer({ logger: false });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tokens/resolve?address=0x1111111111111111111111111111111111111111',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json() as unknown as {
      address: string;
      decimals: number;
      symbol: string;
      name: string;
      isNative: boolean;
    };
    expect(json.address).toBe('0x1111111111111111111111111111111111111111');
    expect(json.decimals).toBe(18);
    expect(json.symbol).toBe('TKN');
    expect(json.name).toBe('Test Token');
    expect(json.isNative).toBe(false);
  });

  it('handles native sentinel', async () => {
    const app = createServer({ logger: false });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tokens/resolve?address=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    });

    expect(res.statusCode).toBe(200);
    const json = res.json() as unknown as {
      symbol: string;
      decimals: number;
      isNative: boolean;
    };
    expect(json.symbol).toBe('BNB');
    expect(json.decimals).toBe(18);
    expect(json.isNative).toBe(true);
  });
});
