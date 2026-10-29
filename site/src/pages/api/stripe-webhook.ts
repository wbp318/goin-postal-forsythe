export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { verifyWebhook } from '../../lib/stripe';
import { getOrder, saveOrder } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';
import { getCardOrder, saveCardOrder } from '../../lib/cardOrders';
import { getMailbox, getMailboxBySubscription, updateMailbox } from '../../shipping/store';
import { statusFromStripe } from '../../lib/mailboxes';

// Stripe calls this when a Checkout session is paid. Point the webhook at /api/stripe-webhook
// with the events checkout.session.completed, customer.subscription.updated and
// customer.subscription.deleted (the last two keep mailbox subscriptions in step).
export const POST: APIRoute = async ({ request }) => {
  let event;
  try {
    event = await verifyWebhook(env, request);
  } catch (e: any) {
    return new Response(`Webhook error: ${e.message}`, { status: 400 });
  }
  if (event.type === 'checkout.session.completed') {
    const session: any = event.data.object;
    const ref: string = session.client_reference_id ?? '';
    if (ref.startsWith('MB-')) {
      const m = await getMailbox(env, ref);
      if (m && m.status === 'awaiting_payment') {
        const sub: string | null = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
        await updateMailbox(env, m.code, { status: 'active', stripe_session_id: session.id, stripe_customer_id: typeof session.customer === 'string' ? session.customer : null, stripe_subscription_id: sub, started_at: new Date().toISOString() });
      }
      return new Response('ok');
    }
    if (ref.startsWith('CD-')) {
      const c = await getCardOrder(env, ref);
      if (c && c.status === 'awaiting_payment') await saveCardOrder(env, { ...c, status: 'paid', stripe_session_id: session.id, paid_at: new Date().toISOString() });
      return new Response('ok');
    }
    const order = await getOrder(env, ref);
    if (order && order.status === 'awaiting_payment') {
      await saveOrder(env, { ...order, stripe_session_id: session.id, paid_at: new Date().toISOString() });
      await fulfil(env, { ...order, stripe_session_id: session.id, paid_at: new Date().toISOString() });
    }
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub: any = event.data.object;
    const m = await getMailboxBySubscription(env, sub.id);
    if (m && m.status !== 'cancelled') {
      const status = event.type === 'customer.subscription.deleted' ? 'cancelled' : statusFromStripe(String(sub.status));
      await updateMailbox(env, m.code, { status, current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : m.current_period_end, cancelled_at: status === 'cancelled' ? new Date().toISOString() : null });
    }
  }
  return new Response('ok');
};
