export function formatDecimalFromRatio(input: {
  numerator: bigint;
  denominator: bigint;
  decimals: number;
}): string {
  const denom = input.denominator === 0n ? 1n : input.denominator;
  const scale = 10n ** BigInt(input.decimals);
  const value = (input.numerator * scale) / denom;
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
