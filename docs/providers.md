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

The runtime registry lives in `packages/adapters/src/registry.ts`.

### Capability legend
- `quote`: SwapPilot can return a quote value (may still be stubbed until integration is complete)
- `buildTx`: SwapPilot can build an executable transaction (Option 2; expected `false` for Option 1 today)
- `deepLink`: SwapPilot can redirect the user to the provider UI

### Registry table (Top 6 + PancakeSwap)

| Provider | providerId | Category | quote | buildTx | deepLink | Integration confidence | Approach |
|---------|------------|----------|-------|---------|----------|------------------------|----------|
| Binance Wallet | `binance-wallet` | wallet | ✅ (stub) | ❌ | ✅ | 0.20 | Deep-link now; official API later |
| OKX DEX | `okx-dex` | aggregator | ✅ (stub) | ❌ | ✅ | 0.20 | Deep-link now; official API later |
| 1inch | `1inch` | aggregator | ✅ (stub) | ❌ | ✅ | 0.25 | Deep-link now; official API later |
| LiquidMesh | `liquidmesh` | aggregator | ✅ (stub) | ❌ | ✅ | 0.10 | Deep-link generic; integration TBD |
| KyberSwap | `kyberswap` | aggregator | ✅ (stub) | ❌ | ✅ | 0.25 | Deep-link now; official API later |
| MetaMask | `metamask` | wallet | ✅ (stub) | ❌ | ✅ | 0.15 | Deep-link now; MetaMask-managed routing |
| PancakeSwap | `pancakeswap` | dex | ❌ | ❌ | ✅ | 0.60 | Deep-link now; on-chain quote later |

### PancakeSwap (DEX)
- `providerId`: `pancakeswap`
- `type`: `dex`
- Current capabilities: `quote=false`, `buildTx=false`, `deepLink=true`
- Integration:
  - Deep-link to PancakeSwap swap UI (implemented)
  - Quote via on-chain calls later (v2 router `getAmountsOut`, v3 quoter if available)
- Rate limits: N/A (on-chain calls limited by RPC)
- Deep-link: see `docs/pancakeswap.md`

### Aggregators (to be enabled progressively)
Each aggregator must satisfy:
- official API only (no UI scraping)
- Zod-validated responses
- strict timeout + concurrency cap
- domain allowlist

Recommended pattern for initial bring-up:
- implement adapter stub with clear capability flags and a deep-link
- treat `quote=true` as “shape available” until the integration confidence reaches 0.8+
- flip to “real quote” only after schema + rate limits + error mapping are confirmed

## Known constraints (current)
- No scraping, no browser automation. Only structured deep-links or official APIs.
- Today, provider quotes are **stubbed** (except that PancakeSwap is deep-link only with `quote=false`).
- `/v1/quotes` returns provider entries with `capabilities` so the UI can label “deep-link only”.

## TODOs
- Implement real quote adapters behind allowlisted domains + timeouts.
- Add per-provider concurrency limits + retries based on upstream characteristics.
- Add on-chain quoting for PancakeSwap per `docs/pancakeswap.md`.

## Rate limiting strategy
- API layer: IP-based rate limiting.
- Adapter layer: per-provider concurrency limit and timeout.
- RPC: configurable via env; consider quorum later.

## Deep-link rules
- Deep-links must be generated deterministically from request params.
- Deep-link generation must not leak secrets.
- Wallet address (`account`) is optional and used for convenience only.
