export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getOrder, saveOrder } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';
import { json } from '../../lib/validate';
import { voidLabel } from '../../shipping/engine';
import { setShipmentStatus } from '../../shipping/store';

// Staff actions from /counter/[code]. Needs the COUNTER_PIN.
// action "paid": staff rang the international order up on the Goin' Postal POS, buy the label now.
// action "printed": mark the label as printed in the shop.
// action "void": the label was bought but the package is not going; void it with the carrier.
// action "cancel": drop a quote that never got a label (customer changed their mind, or never paid).
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  if (!env.COUNTER_PIN || String(b.pin) !== env.COUNTER_PIN) return json({ error: 'Wrong PIN' }, 403);
  const order = await getOrder(env, String(b.order ?? ''));
  if (!order) return json({ error: 'No such order' }, 404);
  try {
    if (b.action === 'paid' && order.status === 'reserved') {
      const next = await fulfil(env, { ...order, paid_at: new Date().toISOString() }, 'pos');
      return json({ status: next.status, label_url: next.label?.label_url });
    }
    if (b.action === 'printed' && order.status === 'labeled') {
      await saveOrder(env, { ...order, status: 'printed', printed_at: new Date().toISOString() });
      return json({ status: 'printed' });
    }
    if (b.action === 'void' && (order.status === 'labeled' || order.status === 'printed') && order.label) {
      await voidLabel(env, order.label.id);
      await saveOrder(env, { ...order, status: 'voided', voided_at: new Date().toISOString() });
      await setShipmentStatus(env, order.id, 'voided');
      return json({ status: 'voided' });
    }
    if (b.action === 'cancel' && (order.status === 'awaiting_payment' || order.status === 'reserved')) {
      await saveOrder(env, { ...order, status: 'cancelled', cancelled_at: new Date().toISOString() });
      return json({ status: 'cancelled' });
    }
    return json({ error: `Cannot ${b.action} an order that is ${order.status}` }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
