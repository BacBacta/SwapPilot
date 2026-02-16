# Security — Threat Model & Baselines

## Non-negotiable
- No API keys or secrets in frontend.
- Rate limit API.
- Protect adapters from SSRF via domain allowlist.
- No web scraping of provider UIs.
- RPC endpoints configurable via env; support quorum where relevant.
- Never log private data, wallet addresses, or full tx calldata unless explicitly allowed and redacted.

## Threat model (minimum)

### SSRF via adapters
Risk: attacker supplies a URL or forces an adapter to call internal services.
Controls:
- domain allowlist per adapter (hard fail if not allowed)
- no user-provided base URLs
- enforce HTTPS where applicable
- strict timeouts and response size limits

### Key leakage
Risk: provider API keys or RPC credentials leak to frontend, logs, or receipts.
Controls:
- keys only in server env
- never return keys in API responses
- redact secrets in logs and error payloads

### Malicious tokens / hostile ERC-20 behavior
Risk: transfer-fee tokens, reverts, blacklists, honeypots.
Controls:
- sellability is always `OK`/`UNCERTAIN`/`FAIL` with confidence; never guarantee
- conservative defaults when unsure (`UNCERTAIN`)
- avoid logging calldata; avoid storing sensitive token interaction details

### Log / receipt data leakage
Risk: wallet addresses or sensitive request details persist.
Controls:
- receipts store sanitized request only
- never store wallet address unless explicitly approved (default: omit)
- structured logs with redaction

## Logging
- Use structured logging.
- Include `requestId` and `providerId`.
- Redact secrets and sensitive values.

## External calls
- Zod validate inputs and provider outputs.
- Apply strict timeouts.
- Limit concurrency.

## RPC simulation safety (preflight)
SwapPilot may perform **read-only** JSON-RPC calls to estimate revert risk for a candidate transaction request (`txRequest`).

Defaults:
- Only `eth_estimateGas` and `eth_call` are used.
- No tracing calls are used by default.

Guards:
- Any tracing (e.g. `debug_traceCall`) MUST be disabled by default and only enabled behind an explicit env flag.
- Always return probabilities (`pRevert`) and a `confidence` score; never claim guarantees.

Configuration (env):
- `BSC_RPC_URLS` (comma-separated)
- `RPC_QUORUM` (e.g. 2 or 3)
- `RPC_TIMEOUT_MS`
- `RPC_ENABLE_TRACE` (must be false by default)

## Transaction target / spender allowlist (buildTx)

Risk: Aggregator APIs may return a transaction target (`tx.to`) and an ERC-20 approval spender (`approvalAddress`) that, if malicious, could trick users into approving the wrong contract.

Controls:
- Server-side allowlist validation for `tx.to` and the approval spender.
- Mode can be configured:
	- `TX_ALLOWLIST_MODE=off` (disabled)
	- `TX_ALLOWLIST_MODE=warn` (log and allow)
	- `TX_ALLOWLIST_MODE=enforce` (reject buildTx if not allowlisted)

Per-provider allowlist (CSV of addresses):
- `TX_ALLOWLIST_<CHAINID>_<PROVIDER>_TARGETS`
- `TX_ALLOWLIST_<CHAINID>_<PROVIDER>_SPENDERS`

Examples:
- `TX_ALLOWLIST_56_ONEINCH_TARGETS=0x...,0x...`
- `TX_ALLOWLIST_56_OKX_DEX_SPENDERS=0x...`

## Storage
- Receipts must not store sensitive data; store sanitized request and summaries.
