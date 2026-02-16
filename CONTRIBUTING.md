# Contributing to SwapPilot

Thank you for your interest in contributing to SwapPilot! This document provides guidelines for contributions.

## Security

**If you discover a security vulnerability, please do NOT open an issue.** Instead, follow our [Security Policy](./SECURITY.md) for responsible disclosure.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/<your-user>/SwapPilot.git`
3. **Install dependencies**: `pnpm install`
4. **Run tests**: `pnpm vitest run`
5. **Compile contracts**: `cd contracts && npx hardhat compile`

## Development Workflow

- Create a feature branch from `main`
- Follow the existing code style and conventions
- Write or update tests for your changes
- Ensure all tests pass before submitting a PR

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New features
- `fix:` — Bug fixes
- `security:` — Security improvements
- `docs:` — Documentation updates
- `test:` — Test additions/changes
- `refactor:` — Code refactoring

## Code Standards

- **TypeScript** for all packages and API code
- **Solidity 0.8.20** for smart contracts (OpenZeppelin 5.x)
- **Zod** for runtime validation (v4 — use `.issues` not `.errors`)
- **Vitest** for unit tests, **Playwright** for E2E tests
- All external HTTP calls must use `safeFetch()` (SSRF protection)
- Sensitive string comparisons must use `timingSafeStringEqual()`

## Project Structure

- `apps/api/` — Fastify API server
- `apps/web/` — Next.js frontend
- `contracts/` — Solidity smart contracts
- `packages/` — Shared libraries (adapters, fees, risk, shared, etc.)

## Pull Request Guidelines

1. Provide a clear description of changes
2. Reference any related issues
3. Ensure CI passes (tests, linting, compilation)
4. Keep PRs focused — one concern per PR

## Bug Bounty

SwapPilot maintains a bug bounty program. See [SECURITY.md](./SECURITY.md) for severity tiers and reward ranges.

## License

By contributing, you agree that your contributions will be licensed under the project's existing license.
