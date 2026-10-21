export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getRates } from '../../lib/easyship';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { store } from '../../data/store';

export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const origin = b.origin ? parseAddress(b.origin) : store.origin;
    const destination = parseAddress(b.destination);
    const parcel = parseParcel(b.parcel);
    const rates = await getRates(env.EASYSHIP_TOKEN, origin, destination, parcel);
    return json({ rates, international: destination.country_alpha2 !== 'US', mock: !env.EASYSHIP_TOKEN });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
