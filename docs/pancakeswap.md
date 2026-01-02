# PancakeSwap (DEX) — Integration Plan

## Option 1 constraints
- SwapPilot must not execute swaps.
- PancakeSwap must be available as a DEX direct source:
  - Deep-link is mandatory.
  - On-chain quote is preferred when feasible; otherwise `capabilities.quote=false`.

## Current status
- Registry entry exists as providerId `pancakeswap` (category: DEX).
- Capabilities: `quote=true`, `buildTx=true`, `deepLink=true`.
- ✅ Deep-link builder is implemented in `packages/deeplinks`.
- ✅ V2 on-chain quoting via `getAmountsOut` is implemented.

## Enabling on-chain quotes (BNB Chain)
SwapPilot can turn PancakeSwap into a real quote source (not deep-link only) when you configure known contract addresses.

### v2 quoting (Router.getAmountsOut) ✅ IMPLEMENTED
The adapter calls `eth_call` on the Router function `getAmountsOut(amountIn, path)` (no transactions) and returns the last element of the `amounts[]` array as `buyAmount`.

Config (env):
- `BSC_RPC_URLS`: comma-separated allowlist of RPC endpoints (SwapPilot uses the first URL for PancakeSwap quoting)
- `PANCAKESWAP_V2_ROUTER`: Router contract address (required to enable v2 quoting)
- `PANCAKESWAP_WBNB`: wrapped native token address used when a request uses a native placeholder (default: BSC mainnet WBNB)
- `PANCAKESWAP_QUOTE_TIMEOUT_MS`: RPC timeout for quoting (default: 2000ms)

Notes / limitations (current implementation):
- Chain: only `chainId=56` (BNB Chain).
- Path: direct path only (`[sellToken, buyToken]`), no multi-hop.
- Tokens: supports ERC-20 addresses, and maps common native placeholders to `PANCAKESWAP_WBNB`:
  - `0x0000000000000000000000000000000000000000`
  - `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`
- If config is missing/invalid or RPC reverts/errors, SwapPilot falls back to deep-link only for PancakeSwap.

### v3 quoting (Quoter) ✅ IMPLEMENTED
The adapter calls `eth_call` on the Quoter function `quoteExactInputSingle` (no transactions) and tries all fee tiers (0.01%, 0.05%, 0.25%, 1%) to find the best output.

Config (env):
- `PANCAKESWAP_V3_QUOTER`: Quoter contract address (default for BSC: `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997`)

Implementation details:
- Tries all 4 fee tiers in parallel, picks best output
- Returns gas estimate from quoter
- Falls back to V2 if no V3 liquidity found
- V3 + V2 comparison: always uses whichever gives better output

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

## Completed
- ✅ On-chain quoting for V2 via `getAmountsOut`
- ✅ On-chain quoting for V3 via `quoteExactInputSingle` (multi-fee tier)
- ✅ RPC allowlist configuration via `BSC_RPC_URLS`
- ✅ Pre-BEQ simulation with output verification
- ✅ V3 + V2 fallback: always picks best quote
- ✅ Gas cost normalization in BEQ scoring

## TODOs
- (No remaining TODOs)

## RPC considerations
- RPC endpoints must be env-configurable.
- Avoid SSRF by not allowing arbitrary RPC URLs.
