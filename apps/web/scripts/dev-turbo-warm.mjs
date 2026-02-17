#!/usr/bin/env node
import { spawn } from 'node:child_process';

const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || 'localhost';

const routes = [
  '/',
  '/swap',
  '/status',
  '/settings',
  '/analytics',
  '/rewards',
  '/token',
];

const nextBin = new URL('../node_modules/.bin/next', import.meta.url).pathname;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(baseUrl, timeoutMs) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(baseUrl, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // ignore
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Dev server not reachable at ${baseUrl} after ${timeoutMs}ms`);
    }
    await sleep(250);
  }
}

async function warm(baseUrl) {
  for (const route of routes) {
    const url = `${baseUrl}${route}`;
    const t0 = Date.now();
    try {
      const res = await fetch(url, { method: 'GET' });
      const ms = Date.now() - t0;
      // Consume body to completion to trigger compilation fully.
      try {
        await res.arrayBuffer();
      } catch {
        // ignore
      }
      // eslint-disable-next-line no-console
      console.log(`[warm] ${route} -> ${res.status} (${ms}ms)`);
    } catch (err) {
      const ms = Date.now() - t0;
      // eslint-disable-next-line no-console
      console.log(`[warm] ${route} -> error (${ms}ms): ${String(err)}`);
    }
  }
}

async function main() {
  const baseUrl = `http://${host}:${port}`;

  const child = spawn(nextBin, ['dev', '--turbo', '-p', String(port)], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  });

  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });

  await waitForServer(baseUrl, 60_000);
  // eslint-disable-next-line no-console
  console.log(`[warm] server ready at ${baseUrl}, warming routes...`);
  await warm(baseUrl);
  // eslint-disable-next-line no-console
  console.log('[warm] done.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(String(err));
  process.exit(1);
});
