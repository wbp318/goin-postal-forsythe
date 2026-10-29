export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getOrder } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';
import { getCardOrder, saveCardOrder } from '../../lib/cardOrders';
import { getMailbox, updateMailbox } from '../../shipping/store';

// Only active when Stripe is not configured. Stands in for a successful Checkout.
export const GET: APIRoute = async ({ url, redirect }) => {
  if (env.STRIPE_SECRET_KEY) return new Response('Not available', { status: 404 });
  const ref = url.searchParams.get('order') ?? '';
  if (ref.startsWith('MB-')) {
    const m = await getMailbox(env, ref);
    if (!m) return new Response('No such mailbox', { status: 404 });
    const end = new Date(); end.setMonth(end.getMonth() + (m.term === 'yearly' ? 12 : 1));
    if (m.status === 'awaiting_payment') await updateMailbox(env, m.code, { status: 'active', started_at: new Date().toISOString(), current_period_end: end.toISOString(), stripe_subscription_id: `mock_sub_${m.code}` });
    return redirect(`/mailbox/done?code=${m.code}`);
  }
  if (ref.startsWith('CD-')) {
    const c = await getCardOrder(env, ref);
    if (!c) return new Response('No such order', { status: 404 });
    if (c.status === 'awaiting_payment') await saveCardOrder(env, { ...c, status: 'paid', paid_at: new Date().toISOString() });
    return redirect(`/cards/done?order=${c.id}`);
  }
  const order = await getOrder(env, ref);
  if (!order) return new Response('No such order', { status: 404 });
  await fulfil(env, { ...order, paid_at: new Date().toISOString() });
  return redirect(`/ship/done?order=${order.id}`);
};
