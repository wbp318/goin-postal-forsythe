export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { verifyWebhook } from '../../lib/stripe';
import { getOrder, saveOrder } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';
import { getCardOrder, saveCardOrder } from '../../lib/cardOrders';

// Stripe calls this when a Checkout session is paid. Point the webhook at /api/stripe-webhook
// with the event checkout.session.completed.
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
  return new Response('ok');
};
