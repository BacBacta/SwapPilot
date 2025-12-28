# PancakeSwap (DEX) — Integration Plan

## Option 1 constraints
- SwapPilot must not execute swaps.
- PancakeSwap must be available as a DEX direct source:
  - Deep-link is mandatory.
  - On-chain quote is preferred when feasible; otherwise `capabilities.quote=false`.

## Deep-link
Goal: send the user to PancakeSwap swap page with tokens + amount prefilled.

Deep-link requirements:
- Always produce a URL if tokens are valid.
- Never embed secrets.
- `account` may be included only if PancakeSwap supports it via URL (otherwise ignore).

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

## RPC considerations
- RPC endpoints must be env-configurable.
- Avoid SSRF by not allowing arbitrary RPC URLs.
