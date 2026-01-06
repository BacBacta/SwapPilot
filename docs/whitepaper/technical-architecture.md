# Technical Architecture

## System Components

SwapPilot is built as a modern, scalable application with three main components:

### Backend API (`apps/api`)

A high-performance Hono-based API server that:
- Handles quote requests from all supported protocols
- Manages rate limiting and caching
- Builds transaction data for execution
- Provides health monitoring and status endpoints

**Technology Stack:**
| Component | Technology |
|-----------|------------|
| Runtime | Node.js with TypeScript |
| Framework | Hono (lightweight, fast HTTP framework) |
| Validation | Zod schemas for type-safe request/response |
| Deployment | Fly.io with global edge distribution |

### Frontend Application (`apps/web`)

A responsive Next.js application providing:
- Intuitive swap interface
- Real-time quote comparison
- Wallet connection (MetaMask, WalletConnect, etc.)
- Transaction history and status tracking

**Technology Stack:**
| Component | Technology |
|-----------|------------|
| Framework | Next.js 14+ with App Router |
| Styling | Tailwind CSS with Shadcn/UI |
| Web3 | wagmi + viem |
| Wallet | RainbowKit |

### Protocol Adapters (`packages/adapters`)

Modular adapter system for DEX protocol integration:

```typescript
interface SwapAdapter {
  id: string;
  name: string;
  getQuote(params: QuoteParams): Promise<SwapQuote>;
  buildTransaction(params: BuildTxParams): Promise<TransactionData>;
}
```

Each adapter normalizes protocol-specific APIs into a unified interface.

## Data Flow

```
User Input → API Gateway → Adapter Layer → DEX Protocols
                ↓
         Quote Aggregation
                ↓
         Route Ranking
                ↓
         User Selection
                ↓
         Transaction Build
                ↓
         Wallet Execution → Blockchain
                ↓
         Receipt Monitoring
                ↓
         Balance Update
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/api/v1/quote` | GET | Get quotes from all providers |
| `/api/v1/quote/:providerId` | GET | Get quote from specific provider |
| `/api/v1/build-tx/:providerId` | POST | Build transaction for execution |
| `/api/v1/providers/status` | GET | Provider availability status |

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| BNB Smart Chain | 56 | ✅ Active |
| Ethereum Mainnet | 1 | 🔜 Planned |
| Arbitrum One | 42161 | 🔜 Planned |
| Polygon | 137 | 🔜 Planned |
