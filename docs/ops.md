# Ops (Option 1)

SwapPilot Option 1 is **non-custodial** and **non-executing**. The API only returns quotes + receipts and (optionally) deep-links.

## Running the API

From repo root:

- Dev: `pnpm --filter @swappilot/api dev`
- Build: `pnpm --filter @swappilot/api... build`
- Start: `pnpm --filter @swappilot/api start`

Endpoints:
- `GET /health`
- `POST /v1/quotes`
- `GET /v1/receipts/:id`
- `GET /docs`
- `GET /metrics` (only when enabled)

## Environment variables

These are parsed by `@swappilot/config`.

### Observability

- `METRICS_ENABLED` (default: true)
  - When true, exposes `GET /metrics` (Prometheus text format).

### Rate limiting

- `RATE_LIMIT_MAX` (default: 120)
- `RATE_LIMIT_WINDOW_MS` (default: 60000)

Notes:
- Rate limiting is per-IP at the Fastify gateway.

### Redis quote cache

- `REDIS_URL` (default: empty)
  - When set, enables Redis-backed quote caching (best-effort).
- `QUOTE_CACHE_TTL_SECONDS` (default: 10)

Notes:
- If Redis is down/unreachable, the API continues without caching.

## Redis via docker-compose

A Redis service is available in [infra/docker-compose.yml](../infra/docker-compose.yml).

From repo root:
- `docker compose -f infra/docker-compose.yml up -d redis`

Then set:
- `REDIS_URL=redis://localhost:6379`

## Docker image (API)

Build from repo root:
- `docker build -f apps/api/Dockerfile -t swappilot-api .`

Run:
- `docker run --rm -p 3001:3001 --env-file .env swappilot-api`

## Basic smoke checks

- Health: `curl -s http://localhost:3001/health | jq .`
- Docs: open `http://localhost:3001/docs`
- Metrics (if enabled): `curl -s http://localhost:3001/metrics | head`
