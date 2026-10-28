// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Pages stay static. Only the routes that export `prerender = false`
// (the shipping API and the order pages) run as Cloudflare functions.
export default defineConfig({
  output: 'static',
  // The adapter's platform proxy is on by default: wrangler.jsonc and .dev.vars are read in `npm run dev`.
  adapter: cloudflare(),
});
