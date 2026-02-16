# SwapPilot — DappBay / RedAlarm Security Audit Report

**Auditor:** DappBay/RedAlarm Security Review  
**Date:** 2026-02-16  
**Scope:** `apps/api/src/`, `apps/web/`, `packages/config/`  
**Risk Level Overall:** 🟡 **MEDIUM** (no critical exploitation path found; multiple areas need hardening)

---

## CRITICAL Findings

### C-1 · Hardcoded Secret in Vendored Template Repo

| Field | Value |
|-------|-------|
| **Severity** | CRITICAL |
| **File** | `apps/web/components/landio-copy-087b2-main/landio-copy-087b2-main/.github/workflows/ci.yml` L28 |
| **Description** | An Unframer deploy demo secret (`--secret 5312773bf94446cb`) is hardcoded in a CI workflow file that is checked into the repository. Any reader of the repo can extract it. |
| **Recommendation** | Delete the entire vendored `landio-copy-087b2-main` directory (it appears to be a third-party template copy). If needed, reference it as a git submodule or extract the secret to a GitHub-encrypted secret. |

---

## HIGH Findings

### H-1 · `dangerouslySetInnerHTML` with Server-Loaded HTML (Stored XSS Vector)

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | `apps/web/components/landio/landio-template.tsx` L31, L35 |
| **Description** | `LandioTemplate` renders both `inlineCss` and `bodyHtml` via `dangerouslySetInnerHTML`. If any of those strings originate from user-controlled or untrusted data (e.g. CMS, admin panel, deep-link query params) the application is vulnerable to stored XSS. Currently the content appears static, but the component API accepts arbitrary HTML. |
| **Recommendation** | 1) Add a code comment explicitly documenting the trust boundary. 2) Sanitize with DOMPurify before injection. 3) Consider converting the static HTML to React components. |

### H-2 · Multiple `innerHTML` Assignments in Landio Controllers

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Files** | `apps/web/components/landio/controllers/landio-analytics-controller.tsx` L37, `landio-status-controller.tsx` L354-L426, `landio-home-controller.tsx` L304-L578, `landio-swap-controller.tsx` L133-L484 |
| **Description** | Landio controllers build HTML strings (including API response data like provider names, dates, wallet addresses) and inject them via `el.innerHTML = html`. Although most data comes from own API, if any provider name or incident message contains `<script>` or event handlers, it will execute in the user's browser. |
| **Recommendation** | Use `textContent` for plain text, or use a sanitization library (DOMPurify) for any value inserted into `innerHTML`. Alternatively, refactor to use React components. |

### H-3 · CSP Allows `'unsafe-eval'` and `'unsafe-inline'`

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | `apps/web/next.config.ts` L87-L95 |
| **Description** | The Content-Security-Policy includes `script-src 'self' 'unsafe-eval' 'unsafe-inline'`. This effectively neutralizes CSP's XSS protection because any injected script (see H-1, H-2) will execute. |
| **Recommendation** | Remove `'unsafe-eval'` (incompatible with Next.js dev mode, but can be restricted to production). Replace `'unsafe-inline'` with nonce-based CSP (`'nonce-xxx'` per request). Next.js supports CSP nonces via `next.config` headers. |

### H-4 · 15 Known Dependency Vulnerabilities (8 High)

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Tool** | `pnpm audit` |
| **Description** | The dependency tree has 15 known vulnerabilities: **8 high** (preact JSON VNode injection, hono JWT confusion ×2, h3 request smuggling, next.js DoS, fastify Content-Type bypass, brace-expansion ReDoS, axios prototype pollution), **6 moderate**, **1 low**. Key packages: `fastify ≤5.7.2`, `next ≥10 <15.5.10`, `hono <4.11.7`, `preact <10.28.2`, `axios ≤1.13.4`. |
| **Recommendation** | Run `pnpm update` for direct dependencies. For transitive deps: `pnpm --filter @swappilot/web audit fix` or add `pnpm.overrides` in root `package.json` to force patched versions. Prioritize fastify and next.js upgrades. |

### H-5 · Swagger UI Exposed in Non-Production

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **File** | `apps/api/src/server.ts` L237-L240 |
| **Description** | Swagger UI is available at `/docs` when `NODE_ENV !== 'production'`. In staging/preview environments this exposes the full API schema, including admin-only endpoints, schema details for analytics, and internal route structures. |
| **Recommendation** | Gate Swagger UI behind `requireAdminToken` or disable it entirely outside local development (`NODE_ENV === 'development'` only). |

---

## MEDIUM Findings

### M-1 · PostHog Session Recording Enabled in Production

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `apps/web/components/providers/posthog-provider.tsx` L16 |
| **Description** | `disable_session_recording: process.env.NODE_ENV !== 'production'` means session recording is **enabled** in production. Session replays may capture wallet addresses, token balances, swap amounts, and UI interactions — raising GDPR/privacy concerns. |
| **Recommendation** | Set `disable_session_recording: true` unless explicit user consent is collected. At minimum, configure PostHog masking rules (`maskAllInputs: true`, `maskAllText: true`). |

### M-2 · No CSRF Protection on State-Changing Endpoints

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `apps/api/src/server.ts` (all POST endpoints) |
| **Description** | The API relies solely on CORS (origin-based) for cross-origin protection. There is no CSRF token or `SameSite` cookie enforcement. Since `credentials: true` is set on CORS, any subdomain XSS on `*.vercel.app` or `*.swappilot.xyz` could make authenticated requests. The risk is mitigated by the fact that admin endpoints require `x-admin-token` header (not cookie-based). |
| **Recommendation** | For non-admin endpoints (`/v1/quotes`, `/v1/build-tx`, `/v1/fees/calculate`): the risk is lower since they don't carry session cookies. Keep monitoring if auth cookies are introduced. Consider adding `Origin` header validation as a belt-and-suspenders measure. |

### M-3 · CORS Regex Allows Any Vercel Preview Deployment

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `apps/api/src/server.ts` L215 |
| **Description** | The regex `/^https:\/\/swappilot-[a-z0-9-]+\.vercel\.app$/` allows any Vercel preview deployment matching the pattern to call the API with credentials. An attacker who names a Vercel project `swappilot-malicious` would have the API origin whitelisted. |
| **Recommendation** | Pin the CORS regex to only match known Vercel team/project patterns, or use a server-side allowlist of specific preview URLs. |

### M-4 · Admin Token Comparison on `/debug/sentry` Uses Non-Constant-Time Comparison

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `apps/api/src/server.ts` L293-L298 |
| **Description** | The `x-sentry-test-token` header is compared with `!==` (non-constant-time) unlike the admin token which uses `timingSafeStringEqual`. This leaks token length/prefix via timing side-channel. |
| **Recommendation** | Use `timingSafeStringEqual` for the sentry test token comparison as well, or remove the `/debug/sentry` endpoint entirely. |

### M-5 · `buildTx` Endpoint Exposes Internal Error Messages

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `apps/api/src/server.ts` L1527 |
| **Description** | The `/v1/build-tx` catch block returns `err.message` directly: `Build transaction failed: ${message}`. Upstream adapter errors may contain internal URLs, API keys in query strings, or provider-specific details. |
| **Recommendation** | Map known error types to generic messages. Log the full error server-side, return only a safe error code to the client. |

### M-6 · `connect-src 'self' https: wss: blob:` is Overly Broad

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `apps/web/next.config.ts` L92 |
| **Description** | Allowing `connect-src https:` means the browser can make fetch/XHR requests to *any* HTTPS endpoint. If the app is compromised (XSS), an attacker can exfiltrate data to any domain. |
| **Recommendation** | Restrict `connect-src` to the specific domains used: `'self' https://swappilot-api.fly.dev https://*.walletconnect.com https://*.sentry.io https://app.posthog.com wss://*.walletconnect.com`. |

### M-7 · PostHog `identifyUser` Uses Full Wallet Address

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `apps/web/components/providers/posthog-provider.tsx` L141 |
| **Description** | `ph?.identify(address, properties)` sends the full Ethereum address to PostHog as the user identity. This links all analytics events to a specific blockchain address, which is a privacy concern as the address can be resolved to on-chain activity. |
| **Recommendation** | Use a hashed/truncated version of the address for analytics identification, or use a random session ID instead. |

### M-8 · API Rewrite Proxy Passes All Paths Without Validation

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **File** | `apps/web/next.config.ts` L57-L62 |
| **Description** | The Next.js rewrite `source: '/api/:path*' → destination: '${apiUrl}/:path*'` proxies any path under `/api/` to the backend, including admin endpoints like `/api/metrics`, `/api/v1/analytics/*`. This could allow admin endpoint access via the frontend domain if the admin token is somehow obtained. |
| **Recommendation** | Restrict the rewrite to specific allowed paths (e.g., `/api/v1/quotes`, `/api/v1/build-tx`, `/api/health`). |

---

## LOW Findings

### L-1 · Error Stack Traces Logged to Structured Logger

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | `apps/api/src/obs/logger.ts` L112-L118 |
| **Description** | `logError` includes `error.stack` in structured logs. While stacks are not sent to clients (the global error handler correctly masks 5xx messages as `internal_server_error`), they may appear in log aggregation dashboards visible to more team members. |
| **Recommendation** | Ensure log aggregation (BetterStack/Logtail) access is restricted to security-cleared personnel. Consider redacting file paths from stacks in production. |

### L-2 · `img-src` Allows `https:` (Any HTTPS Image)

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | `apps/web/next.config.ts` L90 |
| **Description** | `img-src 'self' data: blob: https:` allows loading images from any HTTPS domain. While less dangerous than script-src, it can be used for pixel-tracking or exfiltration of user behavior. |
| **Recommendation** | Restrict to the specific image CDNs configured in `next.config.ts images.remotePatterns`. |

### L-3 · Fastify Log Redaction Missing `x-admin-token`

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | `apps/api/src/server.ts` L108 |
| **Description** | The Fastify logger redacts `authorization`, `cookie`, `set-cookie`, and `x-api-key` from request headers, but `x-admin-token` is not in the redact list. Admin tokens may appear in access logs. |
| **Recommendation** | Add `'req.headers.x-admin-token'` to the redact paths array. |

### L-4 · `html lang="fr"` May Not Match User Language

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | `apps/web/app/layout.tsx` L42 |
| **Description** | The root HTML element declares `lang="fr"` (French), but the application content appears to be in English and French. This is a minor accessibility/SEO issue, not a security issue. |
| **Recommendation** | Set to `lang="en"` or implement proper i18n locale detection. |

### L-5 · Receipt ID Regex Not UUID-Strict

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **File** | `apps/api/src/server.ts` L970 |
| **Description** | Receipt `:id` param allows `[A-Za-z0-9_-]{1,64}`. This is acceptably restrictive but allows non-UUID formats. Path traversal is not possible since the regex blocks `/` and `.`. |
| **Recommendation** | No immediate action required. Consider enforcing UUID v4 format if receipt IDs are always UUIDs. |

---

## STRENGTHS

| # | Area | Detail |
|---|------|--------|
| **S-1** | **Input Validation** | All API endpoints use Zod schemas for request body, query, and params validation. This is excellent and prevents injection/type-confusion attacks. |
| **S-2** | **Admin Auth** | Admin endpoints (`/metrics`, `/v1/analytics/*`) are protected by `requireAdminToken` preHandler using `timingSafeStringEqual` — resistant to timing attacks. |
| **S-3** | **Error Handling** | The global error handler correctly masks internal errors (5xx → `internal_server_error`) and avoids leaking stack traces to clients. Expected errors (400/404/429) are not reported to Sentry, reducing noise. |
| **S-4** | **Rate Limiting** | API-wide rate limiting via `@fastify/rate-limit` with configurable `max` and `windowMs`. Rate limit headers are exposed to clients. |
| **S-5** | **Sentry Privacy** | All Sentry configurations (client, server, edge, API) set `sendDefaultPii: false`, preventing PII leakage to error tracking. Browser extension errors are filtered out client-side. |
| **S-6** | **Security Headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `HSTS` with `includeSubDomains` — all correctly set. |
| **S-7** | **CORS Restriction** | CORS is limited to specific origins and a scoped Vercel preview regex. Not `origin: '*'`. |
| **S-8** | **No Hardcoded API Keys** | All provider API keys (1inch, OKX, 0x, BscScan) are loaded from environment variables. No secrets in source code (except C-1). |
| **S-9** | **Wallet Security** | The frontend never handles private keys. All wallet interactions are delegated to the user's wallet provider via wagmi/viem. The `/v1/build-tx` endpoint returns unsigned calldata — the user must sign in their own wallet. |
| **S-10** | **Client-Side Validation** | API responses are validated with Zod (`QuoteResponseSchema.parse(json)`) on the client side, preventing malformed API responses from corrupting state. |
| **S-11** | **Fastify Log Redaction** | Sensitive headers (`authorization`, `cookie`, `x-api-key`) are redacted from structured logs. |
| **S-12** | **PostHog DNT** | PostHog respects `Do Not Track` header via `respect_dnt: true`. |
| **S-13** | **Request IDs** | UUID-based request IDs are generated for every request and propagated via `x-request-id` response header — excellent for audit trails. |

---

## Summary Table

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH     | 5 |
| MEDIUM   | 8 |
| LOW      | 5 |
| **Total** | **19** |

**Verdict:** The application demonstrates strong security fundamentals (Zod validation everywhere, timing-safe admin auth, PII-free Sentry, no client-side private key handling). The main risks are: (1) XSS vectors from `dangerouslySetInnerHTML`/`innerHTML` combined with a weak CSP, (2) known dependency vulnerabilities requiring upgrades, and (3) the hardcoded secret in the vendored template. Address C-1, H-1–H-4 before any DappBay listing.
