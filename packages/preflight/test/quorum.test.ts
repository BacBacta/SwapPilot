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

  it('calculates output mismatch ratio when simulated output is available', () => {
    const out = mergeQuorumResults(
      [
        { 
          rpcUrl: 'a', 
          ok: true, 
          methodsTried: ['eth_call'], 
          reasons: [], 
          simulatedOutput: '950000000000000000', // 0.95 ETH
        },
      ],
      '1000000000000000000', // Expected: 1 ETH
    );
    
    expect(out.ok).toBe(true);
    expect(out.simulatedOutput).toBe('950000000000000000');
    expect(out.outputMismatchRatio).toBeCloseTo(0.95, 2);
    expect(out.reasons).toContain('output_match:within_5%');
  });

  it('detects severe output mismatch (>10% difference)', () => {
    const out = mergeQuorumResults(
      [
        { 
          rpcUrl: 'a', 
          ok: true, 
          methodsTried: ['eth_call'], 
          reasons: [], 
          simulatedOutput: '800000000000000000', // 0.8 ETH (20% less)
        },
      ],
      '1000000000000000000', // Expected: 1 ETH
    );
    
    expect(out.outputMismatchRatio).toBeCloseTo(0.8, 2);
    expect(out.reasons.some(r => r.includes('output_mismatch'))).toBe(true);
  });

  it('uses median simulated output when multiple RPCs report', () => {
    const out = mergeQuorumResults(
      [
        { rpcUrl: 'a', ok: true, methodsTried: ['eth_call'], reasons: [], simulatedOutput: '900' },
        { rpcUrl: 'b', ok: true, methodsTried: ['eth_call'], reasons: [], simulatedOutput: '1000' },
        { rpcUrl: 'c', ok: true, methodsTried: ['eth_call'], reasons: [], simulatedOutput: '950' },
      ],
      '1000',
    );
    
    // Median of [900, 950, 1000] = 950
    expect(out.simulatedOutput).toBe('950');
    expect(out.outputMismatchRatio).toBeCloseTo(0.95, 2);
  });
});
