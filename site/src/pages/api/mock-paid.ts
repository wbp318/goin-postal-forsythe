export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getOrder } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';
import { getCardOrder, saveCardOrder } from '../../lib/cardOrders';
import { payRenewal, saveCard } from '../../lib/mailboxJobs';

// Only active when Stripe is not configured. Stands in for a successful Checkout.
export const GET: APIRoute = async ({ url, redirect }) => {
  if (env.STRIPE_SECRET_KEY) return new Response('Not available', { status: 404 });
  const ref = url.searchParams.get('order') ?? '';
  if (ref.startsWith('MCARD-')) { // a mailbox holder's card on file (Peter, Nov 16 2026): the demo card
    await saveCard(env, ref.slice(6), { payment_method_id: 'pm_mock_visa', brand: 'visa', last4: '4242', exp: '12/30' }, url.searchParams.get('by') || 'customer', null);
    return redirect(url.searchParams.get('back') === 'counter' ? '/counter/mailboxes?card=1' : '/account?card=1#mailbox');
  }
  if (ref.startsWith('MRN-')) { // a mailbox renewal (Peter, Nov 17 2026)
    await payRenewal(env, ref, null);
    return redirect(`/account?renewed=${encodeURIComponent(ref)}#mailbox`);
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
