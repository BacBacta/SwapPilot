import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DecisionReceiptSchema, type DecisionReceipt } from '@swappilot/shared';

import type { ReceiptStore } from './receiptStore';

export class FileReceiptStore implements ReceiptStore {
  constructor(private readonly baseDir: string) {}

  private receiptPath(id: string) {
    return join(this.baseDir, `${id}.json`);
  }

  async put(receipt: DecisionReceipt): Promise<void> {
    const parsed = DecisionReceiptSchema.parse(receipt);
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(this.receiptPath(parsed.id), JSON.stringify(parsed, null, 2), {
      encoding: 'utf8',
    });
  }

  async get(id: string): Promise<DecisionReceipt | null> {
    try {
      const raw = await readFile(this.receiptPath(id), { encoding: 'utf8' });
      return DecisionReceiptSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}
