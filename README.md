# SwapPilot

A DEX aggregator that fetches and ranks swap quotes across multiple providers and executes user-approved swaps built on **BNB Smart Chain (BSC)**, with an EVM-compatible architecture.

## Technology Stack

- **Blockchain**: BNB Smart Chain (BSC) (primary) + EVM-compatible chains
- **Smart Contracts**: Solidity ^0.8.20
- **Frontend**: Next.js + wagmi + viem
- **Development**: Hardhat, OpenZeppelin libraries

## Supported Networks

- **BNB Smart Chain Mainnet** (Chain ID: 56)
- **BNB Smart Chain Testnet** (Chain ID: 97)

## Contract Addresses

| Network | Core Contract | Token Contract | (Optional: Timelock / Referral) |
|---|---|---|---|
| BNB Mainnet (56) | FeeCollectorV2: 0x2083B8b745Ff78c6a00395b1800469c0Dddc966c | PILOTToken: 0xe3f77E20226fdc7BA85E495158615dEF83b48192 | Timelock: 0xF98a25C78Ba1B8d7bC2D816993faD7E7f825B75b · ReferralRewards: 0xFC2B872F6eD62fD28eE789E35862E69adeB82698 · ReferralPool: 0xC02CE39b6807B146397e12Eeb76DaeEDa840e055 |
| BNB Testnet (97) | — (not deployed) | — (not deployed) | — |

## Features

- Best-price discovery by comparing quotes across multiple providers/DEX routes on BSC
- Risk-aware execution modes (Safe/Balanced/Turbo) using signals such as sellability checks and MEV exposure
- Wallet-based execution with explicit user approvals and confirmations (no unlimited approvals)
- Quote explainability via receipts and normalized output/gas estimates
- Full-stack monorepo (web + API + shared packages + contracts) with deployment and observability tooling

## Links

| Resource | URL |
|---|---|
| App | https://app-swappilot.xyz |
| API | https://swappilot-api.fly.dev |
| Documentation | https://swappilot.gitbook.io/untitled |
| Twitter/X | https://x.com/swappilot_dex |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Repository Structure

```
apps/        # web + api
contracts/   # hardhat + solidity
packages/    # adapters, scoring, shared, config
docs/        # architecture, runbooks
```

## License

MIT