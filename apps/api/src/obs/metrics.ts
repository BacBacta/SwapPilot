import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

export type Metrics = {
  registry: Registry;
  httpRequestDurationMs: Histogram<'method' | 'route' | 'status'>;
  providerQuoteDurationMs: Histogram<'providerId' | 'status'>;
  providerQuoteRequestsTotal: Counter<'providerId' | 'status'>;
  preflightVerificationsTotal: Counter<'status'>;
};

export function createMetrics(params?: { collectDefault?: boolean }): Metrics {
  const registry = new Registry();

  if (params?.collectDefault ?? true) {
    collectDefaultMetrics({ register: registry });
  }

  const httpRequestDurationMs = new Histogram({
    name: 'swappilot_http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [registry],
  });

  const providerQuoteDurationMs = new Histogram({
    name: 'swappilot_provider_quote_duration_ms',
    help: 'Provider quote attempt duration in milliseconds',
    labelNames: ['providerId', 'status'] as const,
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
  });

  const providerQuoteRequestsTotal = new Counter({
    name: 'swappilot_provider_quote_requests_total',
    help: 'Provider quote attempts, labeled by success/failure/cache',
    labelNames: ['providerId', 'status'] as const,
    registers: [registry],
  });

  const preflightVerificationsTotal = new Counter({
    name: 'swappilot_preflight_verifications_total',
    help: 'Preflight verification outcomes',
    labelNames: ['status'] as const,
    registers: [registry],
  });

  return {
    registry,
    httpRequestDurationMs,
    providerQuoteDurationMs,
    providerQuoteRequestsTotal,
    preflightVerificationsTotal,
  };
}
