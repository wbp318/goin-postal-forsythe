export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { quote } from '../../lib/quote';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { store } from '../../data/store';

export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const origin = b.origin ? parseAddress(b.origin) : store.origin;
    const destination = parseAddress(b.destination);
    const parcel = parseParcel(b.parcel);
    const { rates, demo, oversize } = await quote(env, origin, destination, parcel);
    // Customers see service, price and days. Cost and provider stay server side.
    const visible = rates.map(({ id, carrier, service, total_charge, currency, min_days, max_days }) => ({ id, carrier, service, total_charge, currency, min_days, max_days }));
    return json({ rates: visible, international: destination.country_alpha2 !== 'US', demo, oversize });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
