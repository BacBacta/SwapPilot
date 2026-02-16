export function formatDecimalFromRatio(input: {
  numerator: bigint;
  denominator: bigint;
  decimals: number;
}): string {
  if (input.denominator === 0n) {
    throw new RangeError('formatDecimalFromRatio: denominator must not be zero');
  }
  const scale = 10n ** BigInt(input.decimals);
  const value = (input.numerator * scale) / input.denominator;
  const intPart = value / scale;
  const fracPart = value % scale;
  const frac = fracPart
    .toString()
    .padStart(input.decimals, '0')
    .replace(/0+$/, '');
  return frac.length === 0 ? intPart.toString() : `${intPart.toString()}.${frac}`;
}

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
