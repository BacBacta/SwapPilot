import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { DecisionReceiptSchema, type DecisionReceipt } from '@swappilot/shared';

import type { ReceiptStore } from './receiptStore';

const RECEIPT_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export class FileReceiptStore implements ReceiptStore {
  constructor(private readonly baseDir: string) {}

  private receiptPath(id: string) {
    if (!RECEIPT_ID_REGEX.test(id)) {
      throw new Error('invalid_receipt_id');
    }

    const basePath = resolve(this.baseDir);
    const filePath = resolve(basePath, `${id}.json`);

    if (filePath !== basePath && !filePath.startsWith(`${basePath}${sep}`)) {
      throw new Error('invalid_receipt_path');
    }

    return filePath;
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
