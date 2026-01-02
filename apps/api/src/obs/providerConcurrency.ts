/**
 * Provider Concurrency Limiter
 * 
 * Manages per-provider concurrency limits to prevent overwhelming upstream APIs.
 * Each provider has its own semaphore with configurable max concurrency.
 */

export type ProviderLimits = {
  /** Maximum concurrent requests per provider */
  maxConcurrency: number;
  /** Maximum retries for transient failures */
  maxRetries: number;
  /** Base delay between retries in ms (exponential backoff) */
  retryDelayMs: number;
  /** Request timeout in ms */
  timeoutMs: number;
};

// Default limits per provider category
const DEFAULT_AGGREGATOR_LIMITS: ProviderLimits = {
  maxConcurrency: 5,
  maxRetries: 2,
  retryDelayMs: 100,
  timeoutMs: 5000,
};

const DEFAULT_DEX_LIMITS: ProviderLimits = {
  maxConcurrency: 3, // Lower for on-chain quotes (RPC-bound)
  maxRetries: 2,
  retryDelayMs: 50,
  timeoutMs: 3000,
};

const DEFAULT_WALLET_LIMITS: ProviderLimits = {
  maxConcurrency: 10, // Deep-link only, no real requests
  maxRetries: 0,
  retryDelayMs: 0,
  timeoutMs: 1000,
};

// Provider-specific overrides
const PROVIDER_LIMITS: Record<string, Partial<ProviderLimits>> = {
  // Aggregators with known rate limits
  '0x': { maxConcurrency: 3, timeoutMs: 4000 },
  '1inch': { maxConcurrency: 3, timeoutMs: 5000 },
  'odos': { maxConcurrency: 5, timeoutMs: 4000 },
  'kyberswap': { maxConcurrency: 5, timeoutMs: 4000 },
  'paraswap': { maxConcurrency: 5, timeoutMs: 4000 },
  'openocean': { maxConcurrency: 5, timeoutMs: 4000 },
  'okx-dex': { maxConcurrency: 3, timeoutMs: 5000 },
  
  // DEXes (on-chain, RPC bound)
  'pancakeswap': { maxConcurrency: 3, timeoutMs: 3000 },
  'uniswap-v2': { maxConcurrency: 3, timeoutMs: 3000 },
  'uniswap-v3': { maxConcurrency: 3, timeoutMs: 3000 },
};

type ProviderCategory = 'aggregator' | 'dex' | 'wallet';

function getDefaultLimits(category: ProviderCategory): ProviderLimits {
  switch (category) {
    case 'aggregator':
      return DEFAULT_AGGREGATOR_LIMITS;
    case 'dex':
      return DEFAULT_DEX_LIMITS;
    case 'wallet':
      return DEFAULT_WALLET_LIMITS;
  }
}

export function getProviderLimits(providerId: string, category: ProviderCategory): ProviderLimits {
  const defaults = getDefaultLimits(category);
  const overrides = PROVIDER_LIMITS[providerId] ?? {};
  return { ...defaults, ...overrides };
}

/**
 * Simple semaphore for limiting concurrent operations
 */
class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.current--;
    }
  }
}

export class ProviderConcurrencyLimiter {
  private semaphores = new Map<string, Semaphore>();
  private limits = new Map<string, ProviderLimits>();

  /**
   * Initialize limits for a provider
   */
  init(providerId: string, category: ProviderCategory): ProviderLimits {
    const limits = getProviderLimits(providerId, category);
    this.limits.set(providerId, limits);
    this.semaphores.set(providerId, new Semaphore(limits.maxConcurrency));
    return limits;
  }

  /**
   * Get limits for a provider (initializes with defaults if not set)
   */
  getLimits(providerId: string, category: ProviderCategory = 'aggregator'): ProviderLimits {
    if (!this.limits.has(providerId)) {
      return this.init(providerId, category);
    }
    return this.limits.get(providerId)!;
  }

  /**
   * Execute a function with concurrency limiting and retry logic
   */
  async execute<T>(
    providerId: string,
    category: ProviderCategory,
    fn: () => Promise<T>,
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<T> {
    const limits = this.getLimits(providerId, category);
    const semaphore = this.semaphores.get(providerId)!;

    // Wait for a slot
    await semaphore.acquire();

    try {
      let lastError: unknown = null;
      const maxAttempts = limits.maxRetries + 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), limits.timeoutMs);

          // If parent signal is already aborted, throw immediately
          if (options?.signal?.aborted) {
            clearTimeout(timeoutId);
            throw new Error('Request aborted');
          }

          // Link parent signal to our controller
          const abortHandler = () => controller.abort();
          options?.signal?.addEventListener('abort', abortHandler);

          try {
            const result = await fn();
            clearTimeout(timeoutId);
            return result;
          } finally {
            clearTimeout(timeoutId);
            options?.signal?.removeEventListener('abort', abortHandler);
          }
        } catch (err) {
          lastError = err;

          // Don't retry on abort
          if (err instanceof Error && err.name === 'AbortError') {
            throw err;
          }

          // Don't retry on last attempt
          if (attempt >= maxAttempts) {
            break;
          }

          // Exponential backoff
          const delay = limits.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      throw lastError;
    } finally {
      semaphore.release();
    }
  }

  /**
   * Get current stats for monitoring
   */
  getStats(): Record<string, { maxConcurrency: number; limits: ProviderLimits }> {
    const stats: Record<string, { maxConcurrency: number; limits: ProviderLimits }> = {};
    for (const [providerId, limits] of this.limits) {
      stats[providerId] = {
        maxConcurrency: limits.maxConcurrency,
        limits,
      };
    }
    return stats;
  }
}

// Singleton instance for the application
let instance: ProviderConcurrencyLimiter | null = null;

export function getProviderConcurrencyLimiter(): ProviderConcurrencyLimiter {
  if (!instance) {
    instance = new ProviderConcurrencyLimiter();
  }
  return instance;
}

export function resetProviderConcurrencyLimiter(): void {
  instance = null;
}
