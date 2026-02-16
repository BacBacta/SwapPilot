import { describe, expect, it, vi } from 'vitest';
import { withRetries, RetryExhaustedError } from '../src/retry';

describe('withRetries', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetries(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('ok');
    const result = await withRetries(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws RetryExhaustedError after all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));
    await expect(
      withRetries(fn, { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry on non-transient errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('validation failed'));
    await expect(
      withRetries(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(1); // no retries
  });

  it('caps maxRetries at 5', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));
    await expect(
      withRetries(fn, { maxRetries: 100, baseDelayMs: 1 }),
    ).rejects.toThrow(RetryExhaustedError);
    // 5 (capped) + 1 initial = 6
    expect(fn).toHaveBeenCalledTimes(6);
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(
      withRetries(fn, { maxRetries: 3, signal: controller.signal, baseDelayMs: 1 }),
    ).rejects.toThrow('Aborted');
  });

  it('supports custom isRetryable predicate', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('custom-retryable'))
      .mockResolvedValue('ok');
    const result = await withRetries(fn, {
      maxRetries: 3,
      baseDelayMs: 1,
      isRetryable: (err) => err instanceof Error && err.message === 'custom-retryable',
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
