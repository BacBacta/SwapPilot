# PancakeSwap (DEX) — Integration Plan

## Option 1 constraints
- SwapPilot must not execute swaps.
- PancakeSwap must be available as a DEX direct source:
  - Deep-link is mandatory.
  - On-chain quote is preferred when feasible; otherwise `capabilities.quote=false`.

## Current status
- Registry entry exists as providerId `pancakeswap` (category: DEX).
- Capabilities today: `quote=false`, `buildTx=false`, `deepLink=true`.
- Deep-link builder is implemented in `packages/deeplinks`.

## Deep-link
Goal: send the user to PancakeSwap swap page with tokens + amount prefilled.

Deep-link requirements:
- Always produce a URL if tokens are valid.
- Never embed secrets.
- `account` may be included only if PancakeSwap supports it via URL (otherwise ignore).

### Implemented deep-link format (current)
- Base: `https://pancakeswap.finance/swap`
- Params:
  - `inputCurrency=<sellToken>`
  - `outputCurrency=<buyToken>`

Notes:
- This is intentionally minimal and stable.
- Amount prefill is intentionally omitted until confirmed stable for BNB Chain.

## On-chain quote approach
### v2
- Use router `getAmountsOut(amountIn, path)`.
- Requirements:
  - discover/construct a path (initially direct pair only, then multi-hop later)
  - resolve wrapped native token for BNB
- Limitations:
  - does not model price impact beyond pool reserves
  - does not include gas cost
  - can revert if path invalid

### v3
- Use a quoter contract if available on BNB Chain.
- Requires pool fee tier selection; may need pool discovery.

## Limitations & UX surfacing
- If quote is unavailable or partial:
  - set `capabilities.quote=false`
  - still return `deepLink`
  - mark sellability as `UNCERTAIN` with explicit reasons
- Expose MEV exposure and revert risk conservatively.

## TODOs
- Implement on-chain quoting for v2 (router `getAmountsOut`) and/or v3 (quoter) with RPC allowlist.
- Normalize gas/fees and integrate into BEQ scoring.

## RPC considerations
- RPC endpoints must be env-configurable.
- Avoid SSRF by not allowing arbitrary RPC URLs.
