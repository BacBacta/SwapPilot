# SwapPilot 🚀

**DEX Aggregator for BNB Smart Chain**

SwapPilot is a decentralized exchange (DEX) aggregator that optimizes token swaps across multiple liquidity sources on BSC. Get the best prices from 1inch, KyberSwap, ParaSwap, and OKX DEX in one place.

## 🔗 Links

| Resource | URL |
|----------|-----|
| 🌐 **App** | [https://app-swappilot.xyz](https://app-swappilot.xyz) |
| 📚 **Documentation** | [GitBook](https://swappilot.gitbook.io/untitled) |
| 🔌 **API** | [https://swappilot-api.fly.dev](https://swappilot-api.fly.dev) |
| 💻 **GitHub** | [https://github.com/BacBacta/SwapPilot](https://github.com/BacBacta/SwapPilot) |
| 🐦 **Twitter** | [https://x.com/swappilot_dex](https://x.com/swappilot_dex) |

## ✨ Features

- 🎯 **Best Price Discovery** - Compare quotes from 4+ DEX protocols
- ⚡ **Fast Execution** - Optimized routing with minimal latency
- 🛡️ **User Protection** - Slippage controls and transaction simulation
- 🌐 **Single Interface** - Unified access to fragmented DeFi liquidity

## 🛠️ Tech Stack

- **Frontend**: Next.js 14+, Tailwind CSS, wagmi, viem
- **Backend**: Hono, TypeScript, Fly.io
- **Blockchain**: BNB Smart Chain (BSC)

## 📦 Project Structure

```
├── apps/
│   ├── api/          # Backend API (Hono)
│   └── web/          # Frontend (Next.js)
├── packages/
│   ├── adapters/     # DEX protocol adapters
│   ├── scoring/      # Quote ranking engine
│   └── shared/       # Shared utilities
├── contracts/        # Smart contracts
└── docs/             # Documentation
```

## 🚀 Getting Started

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build
pnpm build
```

## 📄 License

MIT