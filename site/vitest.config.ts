// Unit tests for PeterShip's libraries and store. Plain Vite config (not Astro's: the Cloudflare
// adapter cannot be pre-bundled here). "cloudflare:workers" is stubbed so nothing has bindings and
// the store falls back to memory, which is exactly what the tests want. Run: npm run test:unit
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { 'cloudflare:workers': fileURLToPath(new URL('./tests/stubs/cloudflare-workers.ts', import.meta.url)) } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
