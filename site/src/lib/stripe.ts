// Stripe Checkout for domestic labels. Card data never touches this site.
import Stripe from 'stripe';
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
      ...(order.addons ?? []).map((l) => ({ quantity: l.qty, price_data: { currency: 'usd', unit_amount: Math.round(l.unit_price * 100), product_data: { name: l.name } } })),
      ...(order.insurance ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(order.insurance.fee * 100), product_data: { name: `Insurance to $${order.insurance.declared_usd}` } } }] : []),
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
        product_data: { name: `${order.quantity} business cards`, description: `Pickup code ${order.id}. Printed at Goin' Postal Forsythe.` },
      },
    }],
    success_url: `${site}/cards/done?order=${order.id}`,
    cancel_url: `${site}/cards?cancelled=${order.id}`,
  });
  return session.url!;
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
