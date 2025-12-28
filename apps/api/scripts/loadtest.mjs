import { performance } from 'node:perf_hooks';

const url = process.env.URL ?? 'http://localhost:3001/v1/quotes';
const total = Number(process.env.N ?? '50');
const concurrency = Number(process.env.C ?? '5');

if (!Number.isFinite(total) || total <= 0) throw new Error('N must be > 0');
if (!Number.isFinite(concurrency) || concurrency <= 0) throw new Error('C must be > 0');

const body = {
  chainId: 56,
  sellToken: '0x0000000000000000000000000000000000000000',
  buyToken: '0x0000000000000000000000000000000000000000',
  sellAmount: '1000000000000000000',
  slippageBps: 50,
  mode: 'NORMAL',
  providers: ['pancakeswap', '1inch'],
};

let ok = 0;
let fail = 0;
const latencies = [];

async function one(i) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      fail++;
      return;
    }

    await res.json();
    ok++;
    latencies.push(performance.now() - t0);
  } catch {
    fail++;
  }

  if ((i + 1) % 10 === 0) {
    process.stdout.write(`.${i + 1}`);
  }
}

async function run() {
  const start = performance.now();
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= total) return;
      await one(i);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));

  const dur = performance.now() - start;
  latencies.sort((a, b) => a - b);

  const p = (q) => {
    if (latencies.length === 0) return null;
    const idx = Math.min(latencies.length - 1, Math.floor(q * latencies.length));
    return latencies[idx];
  };

  console.log('\n');
  console.log(`URL=${url}`);
  console.log(`total=${total} concurrency=${concurrency}`);
  console.log(`ok=${ok} fail=${fail}`);
  console.log(`duration_ms=${dur.toFixed(1)}`);
  console.log(`p50_ms=${p(0.5)?.toFixed(1) ?? 'n/a'} p95_ms=${p(0.95)?.toFixed(1) ?? 'n/a'} p99_ms=${p(0.99)?.toFixed(1) ?? 'n/a'}`);
}

await run();
