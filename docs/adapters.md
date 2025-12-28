# Adapters

## Principle
All quote sources (aggregators and DEX direct) must be behind an `Adapter` interface with strict timeouts, validated IO, and explicit capability flags.

## Required capabilities
Every adapter exposes:
- `quote`: boolean
- `buildTx`: boolean
- `deepLink`: boolean

Option 1: `buildTx` must remain `false` in SwapPilot.

## Adapter contract (concept)
- `id`: stable provider id
- `capabilities`
- `quote(request) -> QuoteResult` (if `capabilities.quote`)
- `deepLink(request, quote?) -> string | null` (if `capabilities.deepLink`)

## PancakeSwap (required)
- Must exist as a DEX direct quote source.
- Deep-link to PancakeSwap swap page.
- Quote:
  - Prefer on-chain calls if feasible:
    - v2: router `getAmountsOut`
    - v3: quoter (if available)
  - Otherwise deep-link only with `capabilities.quote=false`.

## Safety constraints
- Prevent SSRF: allowlist domains for HTTP adapters.
- Timeouts are mandatory per adapter.
- Zod validate all external payloads.

## Stubs
If a provider API is uncertain, implement a stub adapter:
- `capabilities.quote=false`
- `capabilities.deepLink=true` (if deep-link is known)
- explicit TODO in adapter implementation
