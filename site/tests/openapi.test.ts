// The OpenAPI spec (T25) stays in step with the handler: every path the v1 route serves is in the
// spec, and every path in the spec is served. The route is matched on literal strings in the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import spec from '../public/openapi.json';

const handler = readFileSync(new URL('../src/pages/api/v1/[...path].ts', import.meta.url), 'utf8');

describe('openapi.json', () => {
  it('is OpenAPI 3.1 with bearer auth and the documented paths', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.components.securitySchemes)).toEqual(['bearer']);
    const paths = Object.keys(spec.paths);
    for (const p of ['/me', '/rates', '/shipments', '/shipments/{id}', '/shipments/{id}/void', '/batches', '/pickups', '/pickups/{code}/cancel']) expect(paths).toContain(p);
  });
  it('every spec path has a matching branch in the handler, and the handler serves nothing the spec leaves out', () => {
    const served = new Set<string>();
    for (const m of handler.matchAll(/path === '([a-z]+)'/g)) served.add('/' + m[1]);
    if (/seg\[0\] === 'shipments' && seg\[1\]/.test(handler)) { served.add('/shipments/{id}'); served.add('/shipments/{id}/void'); }
    if (/seg\[0\] === 'pickups' && seg\[1\]/.test(handler)) served.add('/pickups/{code}/cancel');
    for (const p of Object.keys(spec.paths)) expect(served.has(p), `spec path ${p} is not served`).toBe(true);
    for (const p of served) expect(Object.keys(spec.paths), `served path ${p} is not in the spec`).toContain(p);
  });
  it('every $ref resolves', () => {
    const text = JSON.stringify(spec);
    for (const m of text.matchAll(/"\$ref":"#\/([^"]+)"/g)) {
      const target = m[1].split('/').reduce((o: any, k) => o?.[k], spec as any);
      expect(target, m[1]).toBeDefined();
    }
  });
});
