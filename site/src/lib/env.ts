// Cloudflare bindings and secrets. Works in `npm run dev` through the adapter's platform proxy.
import { env as cfEnv } from 'cloudflare:workers';
export const env = cfEnv as unknown as Env;
