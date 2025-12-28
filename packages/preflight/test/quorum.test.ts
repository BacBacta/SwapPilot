import { describe, expect, it } from 'vitest';

import { mergeQuorumResults } from '../src/quorum';

describe('mergeQuorumResults', () => {
  it('empty => uncertain with zero confidence', () => {
    const out = mergeQuorumResults([]);
    expect(out.ok).toBe(true);
    expect(out.pRevert).toBe(0.5);
    expect(out.confidence).toBe(0);
  });

  it('all ok => ok true, pRevert 0, confidence 1', () => {
    const out = mergeQuorumResults([
      { rpcUrl: 'a', ok: true, methodsTried: ['eth_call'], reasons: [] },
      { rpcUrl: 'b', ok: true, methodsTried: ['eth_call'], reasons: [] },
    ]);
    expect(out.ok).toBe(true);
    expect(out.pRevert).toBe(0);
    expect(out.confidence).toBe(1);
  });

  it('mixed => ok based on pRevert threshold, confidence reflects agreement', () => {
    const out = mergeQuorumResults([
      { rpcUrl: 'a', ok: true, methodsTried: ['eth_call'], reasons: [] },
      { rpcUrl: 'b', ok: false, methodsTried: ['eth_call'], reasons: ['revert'] },
      { rpcUrl: 'c', ok: true, methodsTried: ['eth_call'], reasons: [] },
    ]);
    expect(out.pRevert).toBeCloseTo(1 / 3);
    expect(out.ok).toBe(true);
    expect(out.confidence).toBeCloseTo(2 / 3);
  });
});
