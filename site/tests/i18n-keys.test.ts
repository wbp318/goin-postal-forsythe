// Every i18n key must be unique across the four string files: the tables are merged, so a repeat
// silently overrides the first (v1.71.0 caught the Customers heading reading "Claims").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FILES = ['strings', 'staff', 'staff2', 'staff3'];
describe('i18n keys', () => {
  it('are unique across strings.ts, staff.ts, staff2.ts and staff3.ts', () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const f of FILES) {
      const src = readFileSync(new URL(`../src/i18n/${f}.ts`, import.meta.url), 'utf8');
      for (const m of src.matchAll(/\n  '([^']+)': s\(/g)) {
        if (seen.has(m[1])) dups.push(`${m[1]} (${seen.get(m[1])} and ${f})`);
        seen.set(m[1], f);
      }
    }
    expect(dups).toEqual([]);
  });
});
