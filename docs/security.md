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

## Storage
- Receipts must not store sensitive data; store sanitized request and summaries.
