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

### txRequest + preflight (new)
Independently of `buildTx`, SwapPilot can run **preflight verification** when a provider integration can produce a transaction request (`txRequest`).

Current state:
- Option 1 remains non-executing.
- A **mock txRequest path** is enabled for at least one provider (currently `1inch`) to populate receipts with preflight + risk signals.
- Real `buildTx` integrations remain a future step (Option 2).

### Registry table (Top 10 Providers)

| Provider | providerId | Category | quote | buildTx | deepLink | Integration confidence | Approach |
|---------|------------|----------|-------|---------|----------|------------------------|----------|
| 0x | `0x` | aggregator | ✅ | ✅ | ✅ | 0.95 | API v1 with API key |
| Odos | `odos` | aggregator | ✅ | ✅ | ✅ | 0.90 | API v2 (BSC) |
| KyberSwap | `kyberswap` | aggregator | ✅ | ✅ | ✅ | 0.85 | Free API |
| OpenOcean | `openocean` | aggregator | ✅ | ✅ | ✅ | 0.85 | Free API |
| ParaSwap | `paraswap` | aggregator | ✅ | ✅ | ✅ | 0.85 | Prices API v5 (free) |
| 1inch | `1inch` | aggregator | ✅ | ✅ | ✅ | 0.90 | API v6 with API key |
| OKX DEX | `okx-dex` | aggregator | ✅ | ✅ | ✅ | 0.85 | API with HMAC-SHA256 |
| PancakeSwap V2 | `pancakeswap` | dex | ✅ | ✅ | ✅ | 0.90 | On-chain `getAmountsOut` |
| Uniswap V2 | `uniswap-v2` | dex | ✅ | ✅ | ✅ | 0.80 | On-chain `getAmountsOut` |
| Uniswap V3 | `uniswap-v3` | dex | ✅ | ✅ | ✅ | 0.75 | On-chain `quoteExactInputSingle` |

### PancakeSwap (DEX)
- `providerId`: `pancakeswap`
- `type`: `dex`
- Current capabilities: `quote=true`, `buildTx=true`, `deepLink=true`
- Integration:
  - ✅ Deep-link to PancakeSwap swap UI (implemented)
  - ✅ Quote via on-chain V2 router `getAmountsOut` (implemented)
  - ⏳ V3 quoter (not yet implemented)
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
- Provider quotes are **real** for configured providers (API keys or RPC URLs required for some).
- `/v1/quotes` returns provider entries with `capabilities` so the UI can display integration status.

## Completed
- ✅ Real quote adapters implemented (0x, Odos, 1inch, KyberSwap, OpenOcean, ParaSwap, OKX DEX)
- ✅ On-chain quoting for PancakeSwap V2, Uniswap V2, Uniswap V3
- ✅ Pre-BEQ simulation with output mismatch detection
- ✅ Dynamic reliability scoring via EWMA health tracking

## TODOs
- Add per-provider concurrency limits + retries based on upstream characteristics.
- Add PancakeSwap V3 quoter support.

## Rate limiting strategy
- API layer: IP-based rate limiting.
- Adapter layer: per-provider concurrency limit and timeout.
- RPC: configurable via env; consider quorum later.

## Deep-link rules
- Deep-links must be generated deterministically from request params.
- Deep-link generation must not leak secrets.
- Wallet address (`account`) is optional and used for convenience only.
