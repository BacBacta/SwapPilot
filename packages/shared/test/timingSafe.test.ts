import { describe, expect, it } from 'vitest';
import {
  timingSafeAddressEqual,
  timingSafeStringEqual,
  normalizeAddress,
  isValidAddress,
} from '../src/timingSafe';

describe('timingSafeAddressEqual', () => {
  const ADDR_A = '0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8';
  const ADDR_A_LOWER = '0xdb400cfa216bb9e4a4f4def037ec3e8018b871a8';
  const ADDR_B = '0xe3f77E20226fdc7BA85E495158615dEF83b48192';

  it('returns true for identical addresses', () => {
    expect(timingSafeAddressEqual(ADDR_A, ADDR_A)).toBe(true);
  });

  it('returns true for case-insensitive match', () => {
    expect(timingSafeAddressEqual(ADDR_A, ADDR_A_LOWER)).toBe(true);
  });

  it('returns false for different addresses', () => {
    expect(timingSafeAddressEqual(ADDR_A, ADDR_B)).toBe(false);
  });

  it('handles addresses without 0x prefix', () => {
    expect(
      timingSafeAddressEqual(ADDR_A.slice(2), ADDR_A_LOWER.slice(2)),
    ).toBe(true);
  });

  it('returns false for invalid length', () => {
    expect(timingSafeAddressEqual('0x1234', '0x5678')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(timingSafeAddressEqual(null as unknown as string, ADDR_A)).toBe(false);
    expect(timingSafeAddressEqual(ADDR_A, undefined as unknown as string)).toBe(false);
  });
});

describe('timingSafeStringEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeStringEqual('secret-token', 'secret-token')).toBe(true);
  });

  it('returns false for different strings', () => {
    expect(timingSafeStringEqual('secret-token', 'wrong-token')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(timingSafeStringEqual('short', 'a-much-longer-string')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(timingSafeStringEqual('', 'something')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(timingSafeStringEqual(42 as unknown as string, 'x')).toBe(false);
  });
});

describe('normalizeAddress', () => {
  it('normalizes a valid checksummed address', () => {
    expect(normalizeAddress('0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8')).toBe(
      '0xdb400cfa216bb9e4a4f4def037ec3e8018b871a8',
    );
  });

  it('throws for invalid length', () => {
    expect(() => normalizeAddress('0x1234')).toThrow('Invalid Ethereum address length');
  });

  it('throws for non-hex characters', () => {
    expect(() => normalizeAddress('0x' + 'zz'.repeat(20))).toThrow('Invalid Ethereum address format');
  });

  it('throws for non-string', () => {
    expect(() => normalizeAddress(123 as unknown as string)).toThrow('Address must be a string');
  });
});

describe('isValidAddress', () => {
  it('returns true for valid address', () => {
    expect(isValidAddress('0xdB400CfA216bb9e4a4F4def037ec3E8018B871a8')).toBe(true);
  });

  it('returns false for invalid address', () => {
    expect(isValidAddress('not-an-address')).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(isValidAddress(42)).toBe(false);
    expect(isValidAddress(null)).toBe(false);
  });
});
