# Repository Standards

## Tooling
- Monorepo: pnpm workspaces + Turborepo
- TypeScript strict everywhere
- Lint: ESLint
- Format: Prettier
- Commits: Conventional Commits
- Tests: Vitest (unit) + minimal API integration tests
- Validation: Zod for all external inputs/outputs
- Logging: pino structured logs

## Commands (required)
- Install: `pnpm i`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`
- Dev: `pnpm dev`

## CI expectation
Main branch must remain green; each commit should pass lint/typecheck/tests.
