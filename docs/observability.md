# Observability

SwapPilot uses a modern observability stack to track errors, metrics, and user behavior.

## Stack Overview

| Tool | Purpose | Free Tier |
|------|---------|-----------|
| **Sentry** | Error tracking & performance | 5K events/month |
| **PostHog** | Product analytics & funnels | 1M events/month |
| **BetterStack (Logtail)** | Log aggregation | 1GB/month |
| **Prometheus** | Metrics (built-in) | Self-hosted |

## Setup

### 1. Sentry (Error Tracking)

1. Create a project at [sentry.io](https://sentry.io)
2. Get your DSN from Project Settings → Client Keys
3. Set environment variables:

```env
# API (Fly.io)
SENTRY_DSN=https://xxx@sentry.io/xxx

# Frontend (Vercel)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=swappilot-web
SENTRY_AUTH_TOKEN=sntrys_xxx  # For source maps upload
```

### 2. PostHog (Analytics)

1. Create a project at [posthog.com](https://posthog.com)
2. Get your API key from Project Settings
3. Set environment variables:

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 3. BetterStack/Logtail (Logs)

1. Create a source at [betterstack.com/logtail](https://betterstack.com/logtail)
2. Get your source token
3. Set environment variable:

```env
LOGTAIL_TOKEN=xxx
```

## Events Tracked

### API Events (Sentry + Logs)

| Event | Description |
|-------|-------------|
| `swap_request` | Quote requested |
| `swap_quote_result` | Quote completed with timing |
| `security_check` | Token security verdict |
| `error` | Unhandled errors |

### Frontend Events (PostHog)

| Event | Description |
|-------|-------------|
| `wallet_connected` | User connected wallet |
| `wallet_disconnected` | User disconnected |
| `swap_initiated` | Swap form submitted |
| `swap_quote_received` | Quotes returned |
| `swap_confirmed` | User confirmed swap |
| `swap_completed` | Transaction successful |
| `swap_failed` | Transaction failed |
| `mode_changed` | SAFE/TURBO toggle |
| `security_warning_shown` | Risk warning displayed |

## Using Analytics in Code

```tsx
import { useAnalytics } from '@/components/providers/posthog-provider';

function SwapButton() {
  const analytics = useAnalytics();

  const handleSwap = () => {
    analytics.trackSwapInitiated({
      sellToken: 'BNB',
      buyToken: 'CAKE',
      sellAmount: '1.5',
      chainId: 56,
      mode: 'safe',
    });
  };
}
```

## Prometheus Metrics

The API exposes metrics at `/metrics` (when `METRICS_ENABLED=true`):

| Metric | Type | Description |
|--------|------|-------------|
| `swappilot_http_request_duration_ms` | Histogram | Request latency |
| `swappilot_provider_quote_duration_ms` | Histogram | Provider response time |
| `swappilot_provider_quote_requests_total` | Counter | Quote attempts by provider |
| `swappilot_preflight_verifications_total` | Counter | Preflight check outcomes |

## Structured Logging

All API logs are JSON-formatted for easy parsing:

```json
{
  "level": "info",
  "time": "2026-01-18T10:30:00.000Z",
  "service": "swappilot-api",
  "env": "production",
  "event": "swap_request",
  "requestId": "abc-123",
  "sellToken": "0xbb4C...",
  "buyToken": "0x0E09...",
  "chainId": 56
}
```

## Redaction

Observability data must not leak secrets or sensitive user data:
- API keys are redacted from logs
- Full wallet addresses are truncated in analytics
- `requestId` is propagated across API logs, adapter logs, and spans
