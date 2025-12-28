# Runbook (Dev)

## Setup
- Node.js LTS recommended
- pnpm required

## Local commands
- `pnpm i`
- `pnpm dev`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

## Env configuration (principles)
- No secrets in frontend
- RPC endpoints via env
- Provider base URLs via env (if needed)

## Troubleshooting
- If a provider fails: check adapter timeout, domain allowlist, and schema validation.
- If quotes disagree: inspect receipt for normalization assumptions.
