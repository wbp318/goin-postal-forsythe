export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { listExceptions } from '../../shipping/store';

// Staff exceptions list: carrier exceptions, returns, labels never scanned, parcels not moving. PIN.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    return json({ exceptions: await listExceptions(env) });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
