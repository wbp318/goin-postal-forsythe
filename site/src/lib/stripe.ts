// Stripe Checkout for domestic labels. Card data never touches this site.
import Stripe from 'stripe';
import type { Order } from './orders';

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
    line_items: [{
      quantity: 1,
      price_data: {
        currency: order.rate.currency.toLowerCase(),
        unit_amount: Math.round(order.rate.total_charge * 100),
        product_data: {
          name: `${order.rate.service} label`,
          description: `To ${order.destination.city}, ${order.destination.state} ${order.destination.postal_code}. Pickup code ${order.id}.`,
        },
      },
    }],
    success_url: `${site}/ship/done?order=${order.id}`,
    cancel_url: `${site}/ship?cancelled=${order.id}`,
  });
  return session.url!;
}

export async function verifyWebhook(env: Env, request: Request): Promise<Stripe.Event> {
  const stripe = stripeClient(env);
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) throw new Error('Stripe is not configured');
  const sig = request.headers.get('stripe-signature') ?? '';
  const raw = await request.text();
  return stripe.webhooks.constructEventAsync(raw, sig, env.STRIPE_WEBHOOK_SECRET);
}
