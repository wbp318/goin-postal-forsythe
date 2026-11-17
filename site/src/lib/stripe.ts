// Stripe Checkout for domestic labels. Card data never touches this site.
import Stripe from 'stripe';
import { store } from '../data/store';
import type { Order } from './orders';
import type { CardOrder } from './cardOrders';

export function stripeClient(env: Env) {
  if (!env.STRIPE_SECRET_KEY) return null; // mock mode
  return new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
}

export async function createCheckout(env: Env, order: Order): Promise<string> {
  const stripe = stripeClient(env);
  const site = env.SITE_URL;
  if (!stripe) {
    // Mock: skip Stripe and go straight to the "paid" handler.
    return `${site}/api/mock-paid?order=${order.id}`;
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.email,
    client_reference_id: order.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: order.rate.currency.toLowerCase(),
          unit_amount: Math.round(order.rate.total_charge * 100),
          product_data: {
            name: `${order.rate.service} label`,
            description: `To ${order.destination.city}, ${order.destination.state} ${order.destination.postal_code}. Pickup code ${order.id}.`,
          },
        },
      },
      ...(order.return_rate ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(order.return_rate.total_charge * 100), product_data: { name: `Return label, ${order.return_rate.service}`, description: `From ${order.destination.city}, ${order.destination.state} back to ${order.origin.city}, ${order.origin.state}.` } } }] : []),
      ...(order.addons ?? []).map((l) => ({ quantity: l.qty, price_data: { currency: 'usd', unit_amount: Math.round(l.unit_price * 100), product_data: { name: l.name } } })),
      ...(order.insurance ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(order.insurance.fee * 100), product_data: { name: `Insurance to $${order.insurance.declared_usd}` } } }] : []),
      ...(order.tax ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(order.tax.amount * 100), product_data: { name: `Sales tax ${order.tax.percent}%` } } }] : []),
      ...(order.fee ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(order.fee.amount * 100), product_data: { name: 'Online convenience fee' } } }] : []),
    ],
    success_url: `${site}/ship/done?order=${order.id}`,
    cancel_url: `${site}/ship?cancelled=${order.id}`,
  });
  return session.url!;
}

export async function createCardCheckout(env: Env, order: CardOrder): Promise<string> {
  const stripe = stripeClient(env);
  const site = env.SITE_URL;
  if (!stripe) return `${site}/api/mock-paid?order=${order.id}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.customer.email,
    client_reference_id: order.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(order.price * 100),
        product_data: { name: `${order.quantity} business cards`, description: `Pickup code ${order.id}. Printed at ${store.name}.` },
      },
    }, ...(order.options ?? []).map((o) => ({ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(o.price * 100), product_data: { name: o.name } } })),
    ...(order.tax ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(order.tax.amount * 100), product_data: { name: `Sales tax ${order.tax.percent}%` } } }] : []),
    ...(order.fee ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(order.fee.amount * 100), product_data: { name: 'Online convenience fee' } } }] : [])],
    success_url: `${site}/cards/done?order=${order.id}`,
    cancel_url: `${site}/cards/design?cancelled=${order.id}`,
  });
  return session.url!;
}


/** A mailbox holder renewing online (Peter, Nov 17 2026). The box is extended when the payment comes back (lib/mailboxJobs.ts). */
export async function createMailboxCheckout(env: Env, r: { code: string; email: string | null; amount: number; box_no: number; term: number; new_paid_through: string }): Promise<string> {
  const stripe = stripeClient(env);
  const site = env.SITE_URL;
  if (!stripe) return `${site}/api/mock-paid?order=${r.code}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ...(r.email ? { customer_email: r.email } : {}),
    client_reference_id: r.code,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(r.amount * 100), product_data: { name: `Mailbox #${r.box_no}, ${r.term === 12 ? '1 year' : '6 months'}`, description: `${store.name}. Paid through ${r.new_paid_through}.` } } }],
    success_url: `${site}/account?renewed=${r.code}#mailbox`,
    cancel_url: `${site}/account#mailbox`,
  });
  return session.url!;
}

// ---- Card on file for mailbox holders (Peter, Nov 16 2026) ----------------------------------------------
// The card is typed on Stripe's own page (Checkout in setup mode), by the holder or at the counter; the site keeps
// only Stripe's ids and the brand, last 4 and expiry. Renewals and overage fees are then charged off-session.
// Peter, Nov 16 2026: saving a card turns automatic renewal on, so the words say so plainly (price and timing are on
// the dashboard next to the button). Turning it off is one switch on the dashboard or at the counter.
export const CARD_CONSENT = 'Saving this card turns on automatic renewal: Goin\u2019 Postal will charge it your mailbox price each time your term (6 months or 1 year) ends, until you turn it off, plus 45 cents for each piece of mail over your box\u2019s limit. We remind you 2 months, 1 month and 1 week before each renewal. Turn it off any time on your mailbox dashboard or at the counter.';

/** The Stripe customer for a holder, created the first time. Null in mock mode. */
export async function ensureStripeCustomer(env: Env, c: { id: string; name: string; email: string | null; phone: string | null }, existing: string | null): Promise<string | null> {
  const stripe = stripeClient(env);
  if (!stripe) return null;
  if (existing) return existing;
  const sc = await stripe.customers.create({ name: c.name, ...(c.email ? { email: c.email } : {}), ...(c.phone ? { phone: c.phone } : {}), metadata: { goin_postal_customer: c.id } });
  return sc.id;
}

/** Stripe's page to save a card. ref is "MCARD-<customer id>"; back is where to return ("account" or "counter"). */
export async function createCardSetup(env: Env, r: { customer_id: string; stripe_customer_id: string | null; added_by: string; back: 'account' | 'counter' }): Promise<string> {
  const stripe = stripeClient(env);
  const site = env.SITE_URL;
  const ret = r.back === 'account' ? `${site}/account?card=1#mailbox` : `${site}/counter/mailboxes?card=1`;
  if (!stripe || !r.stripe_customer_id) return `${site}/api/mock-paid?order=MCARD-${encodeURIComponent(r.customer_id)}&by=${encodeURIComponent(r.added_by)}&back=${r.back}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    currency: 'usd',
    customer: r.stripe_customer_id,
    client_reference_id: `MCARD-${r.customer_id}`,
    metadata: { customer_id: r.customer_id, added_by: r.added_by },
    setup_intent_data: { metadata: { customer_id: r.customer_id } },
    custom_text: { submit: { message: CARD_CONSENT } },
    success_url: ret,
    cancel_url: r.back === 'account' ? `${site}/account#mailbox` : `${site}/counter/mailboxes`,
  });
  return session.url!;
}

/** The saved card from a finished setup session: its payment method id and what to show. */
export async function cardFromSetup(env: Env, session: any): Promise<{ payment_method_id: string; brand: string; last4: string; exp: string } | null> {
  const stripe = stripeClient(env);
  if (!stripe || !session.setup_intent) return null;
  const si = await stripe.setupIntents.retrieve(String(session.setup_intent), { expand: ['payment_method'] });
  const pm: any = si.payment_method;
  if (!pm?.card) return null;
  if (session.customer) await stripe.customers.update(String(session.customer), { invoice_settings: { default_payment_method: pm.id } });
  return { payment_method_id: pm.id, brand: pm.card.brand, last4: pm.card.last4, exp: `${String(pm.card.exp_month).padStart(2, '0')}/${String(pm.card.exp_year).slice(-2)}` };
}

/** Charge the saved card now (the holder isn't there). Mock mode always succeeds. */
export async function chargeSavedCard(env: Env, r: { stripe_customer_id: string | null; payment_method_id: string | null; amount: number; description: string }): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const stripe = stripeClient(env);
  if (!stripe) return { ok: true, ref: `mock_pi_${Date.now()}` };
  if (!r.stripe_customer_id || !r.payment_method_id) return { ok: false, error: 'No card on file' };
  try {
    const pi = await stripe.paymentIntents.create({ amount: Math.round(r.amount * 100), currency: 'usd', customer: r.stripe_customer_id, payment_method: r.payment_method_id, off_session: true, confirm: true, description: r.description });
    return pi.status === 'succeeded' ? { ok: true, ref: pi.id } : { ok: false, error: `Payment ${pi.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.raw?.message ?? e?.message ?? 'The card was declined' };
  }
}

/** A Stripe invoice for a business account's monthly statement, sent by email with a hosted pay link. Null in mock mode. */
export async function createInvoice(env: Env, inv: { email: string | null; name: string; amount: number; description: string }): Promise<{ id: string; url: string | null } | null> {
  const stripe = stripeClient(env);
  if (!stripe || !inv.email) return null;
  const found = await stripe.customers.list({ email: inv.email, limit: 1 });
  const customer = found.data[0] ?? (await stripe.customers.create({ email: inv.email, name: inv.name }));
  await stripe.invoiceItems.create({ customer: customer.id, amount: Math.round(inv.amount * 100), currency: 'usd', description: inv.description });
  const draft = await stripe.invoices.create({ customer: customer.id, collection_method: 'send_invoice', days_until_due: 14, description: inv.description });
  const final = await stripe.invoices.finalizeInvoice(draft.id);
  return { id: final.id, url: final.hosted_invoice_url ?? null };
}

export async function verifyWebhook(env: Env, request: Request): Promise<Stripe.Event> {
  const stripe = stripeClient(env);
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) throw new Error('Stripe is not configured');
  const sig = request.headers.get('stripe-signature') ?? '';
  const raw = await request.text();
  return stripe.webhooks.constructEventAsync(raw, sig, env.STRIPE_WEBHOOK_SECRET);
}
