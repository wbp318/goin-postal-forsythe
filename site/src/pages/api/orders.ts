export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getRates } from '../../lib/easyship';
import { newOrderId, saveOrder, type Order } from '../../lib/orders';
import { createCheckout } from '../../lib/stripe';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { store } from '../../data/store';

// Customer picked a rate. Domestic: start Stripe Checkout. International: reserve and pay at the counter.
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const origin = b.origin ? parseAddress(b.origin) : store.origin;
    const destination = parseAddress(b.destination);
    const parcel = parseParcel(b.parcel);
    const email = String(b.email ?? '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A valid email is needed for the receipt and label');

    // Re-quote server side so the price cannot be edited in the browser.
    const rates = await getRates(env.EASYSHIP_TOKEN, origin, destination, parcel);
    const rate = rates.find((r) => r.courier_service_id === b.courier_service_id);
    if (!rate) throw new Error('That rate is no longer available. Please quote again.');

    const international = destination.country_alpha2 !== 'US';
    const order: Order = {
      id: newOrderId(),
      status: international ? 'reserved' : 'awaiting_payment',
      created_at: new Date().toISOString(),
      email, origin, destination, parcel, rate, international,
    };
    await saveOrder(env, order);

    if (international) return json({ order_id: order.id, next: `/ship/done?order=${order.id}` });
    const url = await createCheckout(env, order);
    return json({ order_id: order.id, next: url });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
