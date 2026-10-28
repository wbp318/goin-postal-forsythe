export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { quote } from '../../lib/quote';
import { newOrderId, saveOrder, type Order } from '../../lib/orders';
import { createCheckout } from '../../lib/stripe';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { store } from '../../data/store';
import { effectiveAddons, priceExtras } from '../../lib/addons';
import { accountForContact } from '../../shipping/store';
import { checkAddress } from '../../lib/address';

// Customer picked a rate. Domestic: start Stripe Checkout. International: reserve and pay at the counter.
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const origin = b.origin ? parseAddress(b.origin) : store.origin;
    const destination = parseAddress(b.destination);
    const check = checkAddress(destination);
    if (check.errors.length) throw new Error(check.errors[0]);
    const parcel = parseParcel(b.parcel);
    const email = String(b.email ?? '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A valid email is needed for the receipt and label');
    const sms = b.sms === true || b.sms === 'on';
    const phone = String(b.phone ?? '').replace(/[^\d+]/g, '').slice(0, 16);
    if (sms && phone.replace(/\D/g, '').length < 10) throw new Error('Enter a phone number for text updates, or untick the box');

    // Re-quote server side so the price cannot be edited in the browser.
    const { rates } = await quote(env, origin, destination, parcel);
    const found = rates.find((r) => r.id === b.rate_id);
    if (!found) throw new Error('That rate is no longer available. Please quote again.');
    // A business account's email gets its discount online too; the card is still charged now.
    const account = await accountForContact(env, email, phone);
    const rate = account && account.discount_percent ? { ...found, total_charge: Math.round(found.total_charge * (1 - account.discount_percent / 100) * 100) / 100 } : found;

    const international = destination.country_alpha2 !== 'US';
    const extras = priceExtras(await effectiveAddons(env), b.addons, parcel.value_usd, b.insure === true || b.insure === 'on');
    const order: Order = {
      id: newOrderId(),
      status: international ? 'reserved' : 'awaiting_payment',
      created_at: new Date().toISOString(),
      email, phone: sms ? phone : undefined, sms, origin, destination, parcel, rate, international,
      addons: extras.addons.length ? extras.addons : undefined, insurance: extras.insurance, total: Math.round((rate.total_charge + extras.extras_total) * 100) / 100,
      account_name: account?.business_name, discount_percent: account?.discount_percent || undefined,
    };
    await saveOrder(env, order);

    if (international) return json({ order_id: order.id, next: `/ship/done?order=${order.id}` });
    const url = await createCheckout(env, order);
    return json({ order_id: order.id, next: url });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
