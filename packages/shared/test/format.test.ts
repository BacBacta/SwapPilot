import { describe, expect, it } from 'vitest';
import { formatDecimalFromRatio, clamp01 } from '../src/format';

describe('formatDecimalFromRatio', () => {
  it('formats simple integer ratio', () => {
    expect(
      formatDecimalFromRatio({ numerator: 10n, denominator: 2n, decimals: 4 }),
    ).toBe('5');
  });

  it('formats fractional ratio', () => {
    expect(
      formatDecimalFromRatio({ numerator: 1n, denominator: 3n, decimals: 6 }),
    ).toBe('0.333333');
  });

  it('handles 1:1 ratio', () => {
    expect(
      formatDecimalFromRatio({ numerator: 1n, denominator: 1n, decimals: 2 }),
    ).toBe('1');
  });

  it('throws RangeError on zero denominator', () => {
    expect(() =>
      formatDecimalFromRatio({ numerator: 100n, denominator: 0n, decimals: 4 }),
    ).toThrow(RangeError);
  });

  it('strips trailing zeros from fractional part', () => {
    expect(
      formatDecimalFromRatio({ numerator: 1n, denominator: 4n, decimals: 6 }),
    ).toBe('0.25');
  });
});

describe('clamp01', () => {
  it('clamps negative to 0', () => {
    expect(clamp01(-5)).toBe(0);
  });

  it('clamps above 1 to 1', () => {
    expect(clamp01(3.7)).toBe(1);
  });

  it('returns value in range unchanged', () => {
    expect(clamp01(0.5)).toBe(0.5);
  });

  it('returns 0 for 0', () => {
    expect(clamp01(0)).toBe(0);
  });

  it('returns 1 for 1', () => {
    expect(clamp01(1)).toBe(1);
  });
});
