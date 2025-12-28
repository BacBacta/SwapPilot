import Redis from 'ioredis';

import type { CachedProviderQuote, QuoteCache } from './quoteCache';

export function createRedisClient(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });
}

export class RedisQuoteCache implements QuoteCache {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<CachedProviderQuote | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as CachedProviderQuote;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  async set(key: string, value: CachedProviderQuote, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', Math.max(1, ttlSeconds));
    } catch {
      return;
    }
  }
}
