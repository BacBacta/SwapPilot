export type ProviderQuoteStatus = 'success' | 'stub' | 'failure' | 'cache_hit' | 'cache_miss';

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

type ProviderStats = {
  // EWMA in [0..1]
  ewmaSuccess: number;
  // EWMA latency in ms
  ewmaLatencyMs: number;
  // Observations count
  n: number;
  lastUpdatedAt: number;
};

export class ProviderHealthTracker {
  private readonly stats = new Map<string, ProviderStats>();

  constructor(
    private readonly params: {
      alpha?: number; // EWMA smoothing, default 0.2
      baselineSuccess?: number; // default 0.8
      baselineLatencyMs?: number; // default 1500
    } = {},
  ) {}

  record(params: { providerId: string; status: ProviderQuoteStatus; durationMs?: number | null }): void {
    const alpha = this.params.alpha ?? 0.2;
    const now = Date.now();

    const current = this.stats.get(params.providerId) ?? {
      ewmaSuccess: this.params.baselineSuccess ?? 0.8,
      ewmaLatencyMs: this.params.baselineLatencyMs ?? 1500,
      n: 0,
      lastUpdatedAt: now,
    };

    const successValue =
      params.status === 'success'
        ? 1
        : params.status === 'failure'
          ? 0
          : params.status === 'stub'
            ? 0.35
            : null;

    const duration = typeof params.durationMs === 'number' && Number.isFinite(params.durationMs)
      ? Math.max(0, params.durationMs)
      : null;

    const next: ProviderStats = {
      ...current,
      n: current.n + 1,
      lastUpdatedAt: now,
    };

    if (successValue != null) {
      next.ewmaSuccess = alpha * successValue + (1 - alpha) * current.ewmaSuccess;
    }
    if (duration != null) {
      next.ewmaLatencyMs = alpha * duration + (1 - alpha) * current.ewmaLatencyMs;
    }

    this.stats.set(params.providerId, next);
  }

  getRuntimeFactor(providerId: string): number {
    const s = this.stats.get(providerId);
    if (!s) return 0.7; // neutral-ish until observed

    // Latency score: 1 at 0ms, ~0.5 at 4s, 0 at >=8s.
    const latencyScore = clamp01(1 - s.ewmaLatencyMs / 8000);
    const successScore = clamp01(s.ewmaSuccess);

    // Keep a floor so providers aren't permanently nuked after one spike.
    return clamp01(0.15 + 0.85 * (successScore * latencyScore));
  }

  getIntegrationConfidence(params: { providerId: string; base: number }): number {
    const base = clamp01(params.base);
    const runtime = this.getRuntimeFactor(params.providerId);
    return clamp01(base * (0.3 + 0.7 * runtime));
  }

  /** Get all provider stats for status dashboard */
  getAllStats(): Array<{
    providerId: string;
    successRate: number;
    latencyMs: number;
    observations: number;
    lastUpdatedAt: number;
  }> {
    const result: Array<{
      providerId: string;
      successRate: number;
      latencyMs: number;
      observations: number;
      lastUpdatedAt: number;
    }> = [];

    for (const [providerId, stats] of this.stats.entries()) {
      result.push({
        providerId,
        successRate: Math.round(stats.ewmaSuccess * 100),
        latencyMs: Math.round(stats.ewmaLatencyMs),
        observations: stats.n,
        lastUpdatedAt: stats.lastUpdatedAt,
      });
    }

    return result.sort((a, b) => b.successRate - a.successRate);
  }
}
