# Providers

## Purpose
SwapPilot (Option 1) is a non-custodial, non-executing meta-aggregation hub. Providers are integrated behind strict adapters.

This document defines:
- the provider inventory
- capabilities per provider (`quote`, `buildTx`, `deepLink`)
- integration method (official API vs on-chain vs deep-link)
- rate-limit expectations
- deep-link formats

## Provider registry (initial)
> This list is intentionally conservative. If an API is uncertain, ship a stub adapter with capability flags and a deep-link.

### PancakeSwap (DEX)
- `providerId`: `pancakeswap`
- `type`: `dex`
- `capabilities`: `quote` (preferred), `buildTx=false` (Option 1), `deepLink=true`
- Integration:
  - Deep-link to Pancake swap UI
  - Quote via on-chain calls if feasible (v2 router `getAmountsOut`, v3 quoter if available)
- Rate limits: N/A (on-chain calls limited by RPC)
- Deep-link: see `docs/pancakeswap.md`

### Aggregators (to be enabled progressively)
Each aggregator must satisfy:
- official API only (no UI scraping)
- Zod-validated responses
- strict timeout + concurrency cap
- domain allowlist

Recommended pattern for initial bring-up:
- implement adapter stub with `quote=false`, `deepLink=true` when the deep-link is known
- flip `quote=true` only after schema + rate limits are confirmed

## Rate limiting strategy
- API layer: IP-based rate limiting.
- Adapter layer: per-provider concurrency limit and timeout.
- RPC: configurable via env; consider quorum later.

## Deep-link rules
- Deep-links must be generated deterministically from request params.
- Deep-link generation must not leak secrets.
- Wallet address (`account`) is optional and used for convenience only.
