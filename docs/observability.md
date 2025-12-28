# Observability

## Minimum scaffolding
- OpenTelemetry traces in API (at least request spans + adapter spans).
- Structured logs compatible with tracing.

## Metrics
- Prometheus metrics endpoint can be added later.

## Required fields
- `requestId` propagated across:
  - API request logs
  - adapter logs
  - OTel spans

## Redaction
Observability data must not leak secrets or sensitive user data.
