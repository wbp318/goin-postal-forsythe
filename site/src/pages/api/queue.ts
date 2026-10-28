export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { quote } from '../../lib/quote';
import { newOrderId, saveOrder, getOrder, type Order } from '../../lib/orders';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { listQueue } from '../../shipping/store';
import { store } from '../../data/store';

// The counter queue, from /counter/queue. Staff PIN required.
//  order:  one order's customer, destination and parcel, to prefill the walk-up form.
//  list:   every quote not yet printed, oldest first, plus what was finished or dropped in the last day.
//  create: a walk-up. Staff typed the address and parcel in and picked a rate; the order is saved as
//          "reserved", the same state an international online order lands in, so the existing
//          "rung up on the POS, buy label" step and the print queue take it from there.
//          With kind "return" the package travels the other way: origin is the far end (typed in),
//          destination is the store, or another address such as a local business's shop. The label
//          is paid here and emailed to the person at the far end with the Email label button.
// Buying, printing, voiding and cancelling go through /api/counter and /api/print as before.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  if (!env.COUNTER_PIN || String(b.pin) !== env.COUNTER_PIN) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'list') return json(await listQueue(env));
    if (b.action === 'order') {
      // Prefill a walk-up from an earlier order ("ship here again" on the customer page).
      const o = await getOrder(env, String(b.order ?? ''));
      if (!o) return json({ error: 'No such order' }, 404);
      return json({ name: o.name ?? '', email: o.email, phone: o.phone ?? '', sms: !!o.sms, destination: o.destination, parcel: o.parcel, kind: o.kind ?? 'ship', origin: o.kind === 'return' ? o.origin : undefined });
    }
    if (b.action === 'create') {
      const isReturn = b.kind === 'return';
      if (isReturn && !b.origin?.line_1) throw new Error("Type the sender's address: where the package is now");
      const origin = isReturn ? parseAddress(b.origin) : store.origin;
      if (isReturn && origin.country_alpha2 !== 'US') throw new Error('Return labels from outside the US need customs paperwork; quote it on the Ship page instead');
      const destination = isReturn && b.return_to === 'store' ? store.origin : parseAddress(b.destination);
      const parcel = parseParcel(b.parcel);
      const email = String(b.email ?? '').trim();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('That email does not look right; leave it blank if they have none');
      const phone = String(b.phone ?? '').replace(/[^\d+]/g, '').slice(0, 16);
      const sms = (b.sms === true || b.sms === 'on') && phone.replace(/\D/g, '').length >= 10;
      const name = String(b.name ?? '').trim().slice(0, 60);
      // Quote again on the server so the price in the queue is the engine's, not the browser's.
      const { rates } = await quote(env, origin, destination, parcel);
      const rate = rates.find((r) => r.id === b.rate_id);
      if (!rate) throw new Error('That rate is no longer available. Quote again.');
      const order: Order = {
        id: newOrderId(), status: 'reserved', created_at: new Date().toISOString(),
        email, phone: phone || undefined, sms, name: name || undefined, source: 'counter', staff: String(b.staff ?? '').trim().slice(0, 20) || undefined,
        origin, destination, parcel, rate, international: destination.country_alpha2 !== 'US', kind: isReturn ? 'return' : 'ship',
      };
      await saveOrder(env, order);
      return json({ ok: true, id: order.id, price: rate.total_charge });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, e.message?.startsWith('Missing') || /must be|look right|no longer/.test(e.message ?? '') ? 400 : 500);
  }
};
