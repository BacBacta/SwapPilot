import { DecisionReceiptSchema, type DecisionReceipt } from '@swappilot/shared';

export type ReceiptStore = {
  put(receipt: DecisionReceipt): Promise<void>;
  get(id: string): Promise<DecisionReceipt | null>;
};

export class MemoryReceiptStore implements ReceiptStore {
  private readonly map = new Map<string, DecisionReceipt>();

  async put(receipt: DecisionReceipt): Promise<void> {
    const parsed = DecisionReceiptSchema.parse(receipt);
    this.map.set(parsed.id, parsed);
  }

  async get(id: string): Promise<DecisionReceipt | null> {
    return this.map.get(id) ?? null;
  }
}
