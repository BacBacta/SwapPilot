# Problem Statement

## Liquidity Fragmentation

The DeFi ecosystem on BSC includes dozens of DEX protocols, each with its own liquidity pools. A token pair might have significantly different prices across:

- PancakeSwap
- Biswap
- MDEX
- BakerySwap
- And many others...

Users must manually check each platform to find the best rate, a time-consuming and error-prone process.

## Price Impact & Slippage

Large trades suffer from significant price impact due to limited liquidity in individual pools. Without proper route optimization, users can lose **1-5% or more** of their trade value to slippage.

### Example: $10,000 USDT → BNB Swap

| Platform | Output | Loss vs Best |
|----------|--------|--------------|
| DEX A | 15.82 BNB | -$0 |
| DEX B | 15.75 BNB | -$44 |
| DEX C | 15.68 BNB | -$88 |

## Technical Complexity

Interacting with multiple DEX protocols requires:

1. **Understanding different contract interfaces** - Each DEX has its own ABI and function signatures
2. **Managing multiple token approvals** - Users must approve each DEX separately
3. **Calculating optimal trade routes** - Complex math involving reserves and fees
4. **Handling failed transactions gracefully** - Different error formats and recovery procedures

This complexity creates barriers for both new and experienced DeFi users.

## Gas Inefficiency

Naive routing through a single DEX often results in suboptimal gas usage. Smart routing can split trades across multiple paths to achieve better overall value even after gas costs.

### Gas Cost Comparison

```
Single Route:    $0.25 gas → 100 tokens output
Split Route:     $0.35 gas → 103 tokens output
Net Benefit:     +2.7 tokens ($2.43 value)
```
