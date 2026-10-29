export const prerender = false;
import type { APIRoute } from 'astro';
import { effectiveAddons, onlineFee, salesTax } from '../../lib/addons';
import { env } from '../../lib/env';
import { authenticate } from '../../lib/auth';
import { logAudit } from '../../shipping/store';
import { sanitizeDesign, PRICES, priceCards } from '../../lib/cards';
import { newCardId, saveCardOrder, type CardOrder } from '../../lib/cardOrders';
import { json } from '../../lib/validate';
import { createCardCheckout } from '../../lib/stripe';

// Customer orders cards. Paid by card on Stripe Checkout at creation, picked up in the shop.
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const quantity = Number(b.quantity);
    if (!PRICES[quantity]) throw new Error('Pick a quantity');
    const priced = priceCards(quantity, b.options);
    const cfg = await effectiveAddons(env);
    const name = String(b.customer?.name ?? '').trim();
    const email = String(b.customer?.email ?? '').trim();
    const phone = String(b.customer?.phone ?? '').trim();
    if (!name) throw new Error('Your name is needed for pickup');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A valid email is needed');
    const order: CardOrder = {
      id: newCardId(),
      created_at: new Date().toISOString(),
      status: 'awaiting_payment',
      customer: { name, email, phone },
      quantity,
      price: priced.price,
      options: priced.options,
      tax: salesTax(cfg, priced.subtotal),
      fee: onlineFee(cfg, priced.subtotal),
      design: sanitizeDesign(b.design),
      notes: String(b.notes ?? '').slice(0, 300),
    };
    order.total = Math.round((priced.subtotal + (order.tax?.amount ?? 0) + (order.fee?.amount ?? 0)) * 100) / 100;
    await saveCardOrder(env, order);
    const url = await createCardCheckout(env, order);
    return json({ order_id: order.id, next: url });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};

// Staff: mark printed or picked up.
export const PUT: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  const { getCardOrder } = await import('../../lib/cardOrders');
  const o = await getCardOrder(env, String(b.order ?? ''));
  if (!o) return json({ error: 'No such order' }, 404);
  if (b.action === 'printed' && o.status === 'paid') o.status = 'printed';
  else if (b.action === 'picked_up' && (o.status === 'paid' || o.status === 'printed')) o.status = 'picked_up';
  else return json({ error: `Cannot ${b.action} an order that is ${o.status}` }, 400);
  await saveCardOrder(env, o);
  await logAudit(env, user, `card.${b.action}`, o.id);
  return json({ status: o.status });
};
