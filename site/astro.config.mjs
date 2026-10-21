// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Pages stay static. Only the routes that export `prerender = false`
// (the shipping API and the order pages) run as Cloudflare functions.
export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    platformProxy: { enabled: true }, // reads wrangler.jsonc so KV and .dev.vars work in `npm run dev`
  }),
});
