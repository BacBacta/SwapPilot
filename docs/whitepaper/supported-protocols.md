# Supported Protocols

## 1inch

**Integration Type:** API v6.0

1inch is the leading DEX aggregator with sophisticated pathfinding algorithms. SwapPilot leverages 1inch's Fusion mode for MEV-protected swaps and their extensive liquidity network.

### Features
- ✅ Access to 300+ liquidity sources
- ✅ Chi gas token optimization
- ✅ Partial fill support
- ✅ MEV protection

### Contract Addresses (BSC)
```
Router: 0x111111125421cA6dc452d289314280a0f8842A65
```

---

## KyberSwap

**Integration Type:** Aggregator API

KyberSwap's Dynamic Market Maker (DMM) protocol provides capital-efficient liquidity pools with amplified returns for liquidity providers.

### Features
- ✅ Dynamic fees based on market conditions
- ✅ Concentrated liquidity positions
- ✅ Cross-chain routing
- ✅ Elastic pools

### Contract Addresses (BSC)
```
Router: 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5
```

---

## ParaSwap

**Integration Type:** API v5

ParaSwap aggregates liquidity from various DEXs and implements a MultiPath routing algorithm to split orders optimally.

### Features
- ✅ MultiPath routing
- ✅ Gas optimization
- ✅ Price impact protection
- ✅ Limit orders

### Contract Addresses (BSC)
```
Augustus Swapper: 0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57
Token Transfer Proxy: 0x216B4B4Ba9F3e719726886d34a177484278BfcAE
```

---

## OKX DEX

**Integration Type:** API v6

OKX DEX aggregator provides access to institutional-grade liquidity and competitive pricing.

### Features
- ✅ Deep liquidity pools
- ✅ Low latency execution
- ✅ Professional trading tools
- ✅ Cross-chain support

### Contract Addresses (BSC)
```
Router: 0x5Dc88340E1c5c6366864Ee415d6034cadd1A9897
```

---

## Protocol Comparison

| Feature | 1inch | KyberSwap | ParaSwap | OKX DEX |
|---------|-------|-----------|----------|---------|
| Liquidity Sources | 300+ | 100+ | 50+ | 100+ |
| Split Routing | ✅ | ✅ | ✅ | ✅ |
| Gas Optimization | ✅ | ✅ | ✅ | ⚠️ |
| MEV Protection | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Limit Orders | ✅ | ✅ | ✅ | ✅ |
