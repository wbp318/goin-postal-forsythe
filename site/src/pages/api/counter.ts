export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getOrder, saveOrder } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';
import { json } from '../../lib/validate';

// Staff actions from /counter/[code]. Needs the COUNTER_PIN.
// action "paid": staff rang the international order up on the Goin' Postal POS, buy the label now.
// action "printed": mark the label as printed in the shop.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  if (!env.COUNTER_PIN || String(b.pin) !== env.COUNTER_PIN) return json({ error: 'Wrong PIN' }, 403);
  const order = await getOrder(env, String(b.order ?? ''));
  if (!order) return json({ error: 'No such order' }, 404);
  try {
    if (b.action === 'paid' && order.status === 'reserved') {
      const next = await fulfil(env, { ...order, paid_at: new Date().toISOString() });
      return json({ status: next.status, label_url: next.label?.label_url });
    }
    if (b.action === 'printed' && order.status === 'labeled') {
      await saveOrder(env, { ...order, status: 'printed', printed_at: new Date().toISOString() });
      return json({ status: 'printed' });
    }
    return json({ error: `Cannot ${b.action} an order that is ${order.status}` }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
