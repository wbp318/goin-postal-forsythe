import { describe, it, expect } from 'vitest';
import { withoutPlace } from '../src/lib/address';

describe('withoutPlace: a street typed with no city or ZIP', () => {
  it('is true for a bare street', () => {
    expect(withoutPlace('1800 Forsythe Ave')).toBe(true);
    expect(withoutPlace('  412 N 3rd St  ')).toBe(true);
  });
  it('is false once a city is typed after a comma', () => {
    expect(withoutPlace('1800 Forsythe Ave, Monroe')).toBe(false);
  });
  it('is false once a ZIP is typed at the end', () => {
    expect(withoutPlace('1800 Forsythe Ave 71201')).toBe(false);
    expect(withoutPlace('1800 Forsythe Ave 71201-1234')).toBe(false);
  });
});
