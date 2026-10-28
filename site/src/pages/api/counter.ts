export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { getOrder, saveOrder } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';
import { json } from '../../lib/validate';
import { authenticate, CAN } from '../../lib/auth';
import { logAudit } from '../../shipping/store';
import { voidLabel } from '../../shipping/engine';
import { setShipmentStatus, saveContacts, getContacts, billShipmentToAccount } from '../../shipping/store';
import { sendEmail } from '../../shipping/notify';
import { store } from '../../data/store';

// Staff actions from /counter/[code]. Needs a staff PIN; every action is written to the audit log with the name.
// action "paid": staff rang the international order up on the Goin' Postal POS, buy the label now.
// action "printed": mark the label as printed in the shop.
// action "void": the label was bought but the package is not going; void it with the carrier.
// action "cancel": drop a quote that never got a label (customer changed their mind, or never paid).
// Both void and cancel need a "reason" in the body; it is saved on the order and in the audit log.
// action "bill": the order belongs to a business account; buy the label now and put it on the next statement.
// action "email": send the label and tracking number to an address, for returns and for anyone who
//                 wants to print at home. Body may carry "email" to set or change the order's address.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  const order = await getOrder(env, String(b.order ?? ''));
  if (!order) return json({ error: 'No such order' }, 404);
  try {
    if (b.action === 'paid' && order.status === 'reserved') {
      const next = await fulfil(env, { ...order, paid_at: new Date().toISOString() }, 'pos');
      await logAudit(env, user, 'label.buy', order.id, `${order.rate.carrier} ${order.rate.service} $${(order.total ?? order.rate.total_charge).toFixed(2)}, POS`);
      return json({ status: next.status, label_url: next.label?.label_url });
    }
    if (b.action === 'bill' && order.status === 'reserved' && order.account_id) {
      const next = await fulfil(env, { ...order, paid_at: new Date().toISOString() }, 'account');
      await billShipmentToAccount(env, order.id, order.account_id);
      await logAudit(env, user, 'label.buy', order.id, `${order.rate.carrier} ${order.rate.service} $${(order.total ?? order.rate.total_charge).toFixed(2)}, billed to ${order.account_name ?? 'account'}`);
      return json({ status: next.status, label_url: next.label?.label_url });
    }
    if (b.action === 'printed' && order.status === 'labeled') {
      await saveOrder(env, { ...order, status: 'printed', printed_at: new Date().toISOString() });
      await logAudit(env, user, 'label.printed', order.id);
      return json({ status: 'printed' });
    }
    const reason = String(b.reason ?? '').trim().slice(0, 200);
    if ((b.action === 'void' || b.action === 'cancel') && !reason) return json({ error: 'A reason is needed' }, 400);
    if (b.action === 'void' && (order.status === 'labeled' || order.status === 'printed') && order.label) {
      await voidLabel(env, order.label.id);
      await saveOrder(env, { ...order, status: 'voided', voided_at: new Date().toISOString(), void_reason: reason });
      await setShipmentStatus(env, order.id, 'voided');
      await logAudit(env, user, 'label.void', order.id, `${reason}. ${order.rate.carrier} ${order.label.tracking_number ?? ''}, paid $${(order.total ?? order.rate.total_charge).toFixed(2)} via ${order.paid_at ? (order.international || order.source === 'counter' ? 'POS' : 'Stripe') : 'nothing'}`);
      return json({ status: 'voided' });
    }
    if (b.action === 'email' && order.label) {
      const email = String(b.email ?? order.email ?? '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter an email address to send the label to' }, 400);
      const l = order.label;
      const abs = (u: string | null | undefined) => (u ? (u.startsWith('/') ? `${env.SITE_URL}${u}` : u) : null);
      const isReturn = order.kind === 'return';
      const lines = [
        isReturn ? `Here is your prepaid return label from ${store.name}.` : `Here is your shipping label from ${store.name}.`,
        '',
        (order.rate.service.toLowerCase().startsWith(order.rate.carrier.toLowerCase()) ? order.rate.service : `${order.rate.carrier} ${order.rate.service}`) + (l.tracking_number ? `, tracking number ${l.tracking_number}` : ''),
        abs(l.label_url) ? `Label (print on plain paper and tape it flat to the box): ${abs(l.label_url)}` : null,
        abs(l.qr_url) ? `No printer? Show this code at any ${order.rate.carrier} location and they print it: ${abs(l.qr_url)}` : null,
        '',
        isReturn
          ? `Pack the item, attach the label and hand the box to ${order.rate.carrier} or bring it to any ${order.rate.carrier} drop-off. It comes to ${order.destination.contact_name}, ${order.destination.city}, ${order.destination.state}.`
          : `Attach the label and drop the box with ${order.rate.carrier}, or bring it to us and we will send it out.`,
        `Track it any time: ${env.SITE_URL}/track?q=${order.id}`,
        '',
        `${store.name}, ${store.address}, ${store.phone}. Pickup code ${order.id}.`,
      ].filter((x) => x !== null);
      const mock = await sendEmail(env, email, `${isReturn ? 'Your return label' : 'Your shipping label'} ${order.id}`, lines.join('\n'));
      const next = { ...order, email, emailed_at: new Date().toISOString() };
      await saveOrder(env, next);
      const c = await getContacts(env, order.id);
      if (c && c.email !== email) await saveContacts(env, order.id, { ...c, email });
      await logAudit(env, user, 'label.email', order.id, email);
      return json({ ok: true, email, mock });
    }
    if (b.action === 'cancel' && (order.status === 'awaiting_payment' || order.status === 'reserved')) {
      await saveOrder(env, { ...order, status: 'cancelled', cancelled_at: new Date().toISOString(), cancel_reason: reason });
      await logAudit(env, user, 'quote.cancel', order.id, reason);
      return json({ status: 'cancelled' });
    }
    return json({ error: `Cannot ${b.action} an order that is ${order.status}` }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
