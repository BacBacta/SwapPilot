type Entry<T> = { value: T; expiresAt: number };

/** Simple LRU-ish TTL cache backed by a Map. Evicts oldest entry when full. */
export class MLCache<T> {
  private readonly map = new Map<string, Entry<T>>();

  constructor(
    private readonly maxSize: number = 1000,
    private readonly ttlMs: number = 30_000,
  ) {}

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
