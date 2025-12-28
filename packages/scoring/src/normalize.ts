import type { ProviderQuoteRaw, ProviderQuoteNormalized } from '@swappilot/shared';

import type { NormalizationAssumptions } from '@swappilot/shared';

export function defaultAssumptions(): NormalizationAssumptions {
  return {
    priceModel: 'ratio_sell_buy',
    effectivePriceScale: 6,
    gasUsdPerTx: null,
    feeModel: 'feeBps_on_buyAmount',
  };
}

function formatRatio(numerator: bigint, denominator: bigint, decimals: number): string {
  if (denominator === 0n) return '0';
  const scale = 10n ** BigInt(decimals);
  const value = (numerator * scale) / denominator;
  const intPart = value / scale;
  const fracPart = value % scale;
  const frac = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac.length === 0 ? intPart.toString() : `${intPart.toString()}.${frac}`;
}

export function normalizeQuote(input: {
  raw: ProviderQuoteRaw;
  assumptions: NormalizationAssumptions;
}): ProviderQuoteNormalized {
  const buyAmount = BigInt(input.raw.buyAmount);
  const sellAmount = BigInt(input.raw.sellAmount);

  // Effective price is buy/sell in base units (placeholder until decimals/prices).
  const effectivePrice = formatRatio(buyAmount, sellAmount === 0n ? 1n : sellAmount, input.assumptions.effectivePriceScale);

  return {
    buyAmount: input.raw.buyAmount,
    effectivePrice,
    estimatedGasUsd: null,
    feesUsd: null,
  };
}
