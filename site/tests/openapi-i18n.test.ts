// Every summary and description in the spec has a translation row in src/i18n/api.ts (v1.72.0), so the
// developer page reads in all fourteen languages. Add the row when you add the string.
import { describe, it, expect } from 'vitest';
import spec from '../public/openapi.json';
import { API_STRINGS } from '../src/i18n/api';
import { LANGS } from '../src/i18n/strings';

const texts = new Set<string>();
const walk = (o: unknown) => {
  if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if ((k === 'summary' || k === 'description') && typeof v === 'string') texts.add(v); else walk(v); }
};
walk(spec);

describe('openapi.json strings', () => {
  it('each have a row in api.ts with all languages filled, keyed by the English text', () => {
    const missing = [...texts].filter((t) => !API_STRINGS[t]);
    expect(missing).toEqual([]);
    const bad = Object.entries(API_STRINGS).filter(([k, row]) => row.en !== k || LANGS.some((l) => !row[l.code]));
    expect(bad.map(([k]) => k)).toEqual([]);
  });
});
