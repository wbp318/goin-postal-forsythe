export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getOrder } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';

// Only active when Stripe is not configured. Stands in for a successful Checkout.
export const GET: APIRoute = async ({ url, redirect }) => {
  if (env.STRIPE_SECRET_KEY) return new Response('Not available', { status: 404 });
  const order = await getOrder(env, url.searchParams.get('order') ?? '');
  if (!order) return new Response('No such order', { status: 404 });
  await fulfil(env, { ...order, paid_at: new Date().toISOString() });
  return redirect(`/ship/done?order=${order.id}`);
};
