import { mkdir, readFile, appendFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { SwapLog, SwapLogQuery, SwapLogStore } from './swapLogStore';

function dateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

export class FileSwapLogStore implements SwapLogStore {
  constructor(private readonly baseDir: string) {}

  private logPath(date: Date): string {
    return join(this.baseDir, `${dateKey(date)}.jsonl`);
  }

  async append(log: SwapLog): Promise<void> {
    const ts = new Date(log.timestamp);
    const date = Number.isNaN(ts.getTime()) ? new Date() : ts;
    await mkdir(this.baseDir, { recursive: true });
    await appendFile(this.logPath(date), `${JSON.stringify(log)}\n`, { encoding: 'utf8' });
  }

  async list(query: SwapLogQuery = {}): Promise<SwapLog[]> {
    try {
      const files = await readdir(this.baseDir);
      const fromMs = query.from?.getTime();
      const toMs = query.to?.getTime();
      const candidates = files
        .filter((name) => name.endsWith('.jsonl'))
        .map((name) => ({
          name,
          date: parseDateKey(name.replace('.jsonl', '')),
        }))
        .filter((entry) => entry.date !== null)
        .filter((entry) => {
          const ms = entry.date!.getTime();
          if (fromMs && ms < fromMs) return false;
          if (toMs && ms > toMs) return false;
          return true;
        });

      const logs: SwapLog[] = [];
      for (const entry of candidates) {
        const raw = await readFile(join(this.baseDir, entry.name), { encoding: 'utf8' });
        const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          try {
            const log = JSON.parse(line) as SwapLog;
            logs.push(log);
          } catch {
            continue;
          }
        }
      }

      return logs.filter((log) => {
        if (query.chainId && log.chainId !== query.chainId) return false;
        if (query.status && log.status !== query.status) return false;
        const ts = Date.parse(log.timestamp);
        if (Number.isNaN(ts)) return false;
        if (fromMs && ts < fromMs) return false;
        if (toMs && ts > toMs) return false;
        return true;
      });
    } catch {
      return [];
    }
  }
}
