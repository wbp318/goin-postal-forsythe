// A second store lays its facts over the Forsythe defaults.
import { describe, it, expect } from 'vitest';
import { defaults, mergeStore, store } from '../src/data/store';

describe('store facts', () => {
  it('with nothing set, the store is Forsythe', () => {
    expect(store.id).toBe('forsythe');
    expect(store.origin.postal_code).toBe('71201');
  });
  it('an override replaces top-level facts and merges the ship-from address field by field', () => {
    const s = mergeStore(defaults, { id: 'west-carroll', name: "Goin' Postal Oak Grove", origin: { line_1: '123 Main St', city: 'Oak Grove', postal_code: '71263' } as any });
    expect(s.name).toBe("Goin' Postal Oak Grove");
    expect(s.origin).toMatchObject({ line_1: '123 Main St', city: 'Oak Grove', state: 'LA', postal_code: '71263', country_alpha2: 'US' });
    expect(s.hours).toEqual(defaults.hours); // untouched lists stay
  });
  it('garbage overrides are ignored', () => {
    expect(mergeStore(defaults, null)).toBe(defaults);
    expect(mergeStore(defaults, 'nope' as any)).toBe(defaults);
  });
});

describe('siblings (T23)', () => {
  it('a store with siblings keeps them as a whole list; a store without has none', () => {
    const m = mergeStore(defaults, { siblings: [{ id: 'west-carroll', name: 'Oak Grove', url: 'https://example.com' }] });
    expect(m.siblings?.map((s) => s.id)).toEqual(['west-carroll']);
    expect(mergeStore(defaults, {}).siblings).toBeUndefined();
  });
});
