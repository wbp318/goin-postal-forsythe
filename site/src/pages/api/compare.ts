export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { compare } from '../../shipping/engine';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { store } from '../../data/store';

// Parity test: every provider's rates side by side for one shipment. Staff PIN required.
// Used in Phase 6 to prove the direct carriers match Easyship and Rate Pro before switching over.
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    if (!env.COUNTER_PIN || String(b.pin) !== env.COUNTER_PIN) return json({ error: 'Wrong PIN' }, 403);
    const origin = b.origin ? parseAddress(b.origin) : store.origin;
    const destination = parseAddress(b.destination);
    const parcel = parseParcel(b.parcel);
    return json({ providers: await compare(env, origin, destination, parcel) });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
