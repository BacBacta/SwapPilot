# Release checklist

## Pre-flight
- [ ] `pnpm -r lint`
- [ ] `pnpm -r typecheck`
- [ ] `pnpm -r test`
- [ ] `pnpm -r build`

## Runtime checks
- [ ] `GET /health` returns `ok`
- [ ] `POST /v1/quotes` returns a receiptId and rankedQuotes
- [ ] `GET /v1/receipts/:id` returns the stored receipt
- [ ] `GET /docs` is reachable
- [ ] `GET /metrics` works when `METRICS_ENABLED=true`
- [ ] Redis disabled mode works (empty `REDIS_URL`)
- [ ] Redis enabled mode works and degrades gracefully if Redis is down

## Security / hygiene
- [ ] No secrets in the web app (all requests go through API)
- [ ] Logs redact sensitive headers (authorization/cookies/api-key)

## Tagging
- [ ] `git tag -a v0.1.0 -m "SwapPilot v0.1.0"`
- [ ] `git push origin v0.1.0`
