/**
 * Retry utility with exponential backoff for resilient HTTP calls.
 * Used by adapters to handle transient failures from external APIs.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number;
  /** Jitter factor 0-1 to randomize delays (default: 0.1) */
  jitterFactor?: number;
  /** HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
  /** Function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Optional abort signal */
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'signal' | 'isRetryable'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterFactor: 0.1,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/**
 * Calculates delay with exponential backoff and jitter.
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  // Add jitter: +/- jitterFactor * cappedDelay
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Sleep for a specified duration, respecting abort signal.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Represents an error that occurred after all retry attempts were exhausted.
 */
export class RetryExhaustedError extends Error {
  public readonly attempts: number;
  public readonly lastError: unknown;

  constructor(attempts: number, lastError: unknown) {
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    super(`Retry exhausted after ${attempts} attempts: ${message}`);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Wraps an async function with retry logic using exponential backoff.
 * 
 * @example
 * ```typescript
 * const result = await withRetries(
 *   () => safeFetch('https://api.example.com/data'),
 *   { maxRetries: 3, baseDelayMs: 500 }
 * );
 * ```
 */
export async function withRetries<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries: rawMaxRetries = DEFAULT_OPTIONS.maxRetries,
    baseDelayMs = DEFAULT_OPTIONS.baseDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    jitterFactor = DEFAULT_OPTIONS.jitterFactor,
    retryableStatuses = DEFAULT_OPTIONS.retryableStatuses,
    isRetryable,
    signal,
  } = options;

  // Hard ceiling to prevent amplification attacks (H-5)
  const maxRetries = Math.min(rawMaxRetries, 5);

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check for abort before each attempt
      if (signal?.aborted) {
        throw new Error('Aborted');
      }

      return await fn();
    } catch (error) {
      lastError = error;

      // Check if this is the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Determine if error is retryable
      let shouldRetry = false;

      if (isRetryable) {
        shouldRetry = isRetryable(error);
      } else if (error instanceof Response) {
        // HTTP Response object (unusual but possible)
        shouldRetry = retryableStatuses.includes(error.status);
      } else if (error instanceof Error) {
        // Check for common transient error patterns
        const errorMessage = error.message.toLowerCase();
        shouldRetry =
          errorMessage.includes('timeout') ||
          errorMessage.includes('econnreset') ||
          errorMessage.includes('econnrefused') ||
          errorMessage.includes('network') ||
          errorMessage.includes('socket hang up') ||
          errorMessage.includes('429') ||
          errorMessage.includes('500') ||
          errorMessage.includes('502') ||
          errorMessage.includes('503') ||
          errorMessage.includes('504');
      }

      if (!shouldRetry) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitterFactor);
      await sleep(delay, signal);
    }
  }

  throw new RetryExhaustedError(maxRetries + 1, lastError);
}

/**
 * Creates a wrapped version of an async function with built-in retry logic.
 * Useful for wrapping adapter methods.
 * 
 * @example
 * ```typescript
 * const fetchWithRetry = withRetriesWrapper(
 *   safeFetch,
 *   { maxRetries: 2 }
 * );
 * ```
 */
export function withRetriesWrapper<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetries(() => fn(...args), options);
}
