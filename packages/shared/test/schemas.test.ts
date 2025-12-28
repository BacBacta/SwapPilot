import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from '../src/schemas';

describe('HealthResponseSchema', () => {
  it('accepts {status: ok}', () => {
    expect(HealthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
  });
});
