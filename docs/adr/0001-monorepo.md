# ADR 0001 — Monorepo (pnpm + Turborepo)

## Status
Accepted

## Context
SwapPilot requires:
- a web UI (`/swap`)
- an API service (`/v1/quotes`, `/v1/receipts/:id`)
- shared domain logic (adapters, normalization, scoring, receipts)

We also require:
- TypeScript strict everywhere
- ESLint + Prettier
- Vitest
- Zod validation
- pino logging
- OpenTelemetry scaffolding

## Decision
Adopt a monorepo with:
- pnpm workspaces
- Turborepo task pipeline

Target structure:
- `apps/web`
- `apps/api`
- `packages/core`
- `packages/config`

## Consequences
- Shared types and domain logic live in `packages/core`.
- Tooling is centralized; CI runs `lint`, `typecheck`, `test`, `build` via turbo.
- Adapters are isolated and can be stubbed without blocking the release.
