export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { priceMailbox, newMailboxCode } from '../../lib/mailboxes';
import { createMailbox, getMailbox, updateMailbox, logAudit, upsertCustomer } from '../../shipping/store';
import { createMailboxCheckout, cancelSubscription } from '../../lib/stripe';
import { notifyMailbox, KINDS, type NoticeKind } from '../../lib/mailboxNotify';

// Mailbox subscriptions. POST: a customer picks a size and a term on /mailbox and goes to Stripe
// Checkout in subscription mode. PUT: staff actions from /counter/mailbox/CODE (box number, Form
// 1583, notes, cancel), PIN required and audited.
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json().catch(() => ({}));
    const { size, term, price } = priceMailbox(String(b.size ?? ''), String(b.term ?? ''));
    const name = String(b.name ?? '').trim().slice(0, 60);
    const email = String(b.email ?? '').trim().slice(0, 80);
    const phone = String(b.phone ?? '').trim().slice(0, 20);
    if (!name) throw new Error('Your name is needed');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A valid email is needed: Stripe sends the receipts there');
    if (!(b.agree === true || b.agree === 'on')) throw new Error('Please confirm you will bring two IDs and sign Form 1583');
    const customer_id = await upsertCustomer(env, { name, email, phone: phone || null });
    const m = await createMailbox(env, {
      code: newMailboxCode(), customer_id, customer_name: name, email, phone: phone || null,
      business_name: String(b.business ?? '').trim().slice(0, 80) || null,
      size: size.id, term, price,
    });
    const next = await createMailboxCheckout(env, m);
    return json({ code: m.code, next });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  const m = await getMailbox(env, String(b.code ?? ''));
  if (!m) return json({ error: 'No such mailbox' }, 404);
  try {
    if (b.action === 'box') {
      const box = String(b.box_number ?? '').trim().slice(0, 10);
      if (!box) throw new Error('A box number is needed');
      if (!m.form_1583_at) throw new Error('Record Form 1583 and the two IDs first: no address before the form');
      await updateMailbox(env, m.code, { box_number: box });
      await logAudit(env, user, 'mailbox.box', m.code, `box ${box}`);
    } else if (b.action === 'form1583') {
      const ids = String(b.ids ?? '').trim().slice(0, 200);
      if (!ids) throw new Error('Note the two IDs seen (type and last digits)');
      await updateMailbox(env, m.code, { form_1583_at: new Date().toISOString(), ids_seen: ids, form_1583_by: user.name });
      await logAudit(env, user, 'mailbox.form1583', m.code, ids);
    } else if (b.action === 'notice') {
      // Mail in, package in: text and email the holder, keep the row. Works on any box that is not cancelled.
      if (m.status === 'cancelled') throw new Error('This mailbox is cancelled');
      const kind = (KINDS as string[]).includes(b.kind) ? (b.kind as NoticeKind) : 'mail';
      const n = await notifyMailbox(env, m, kind, String(b.note ?? '').trim().slice(0, 120), user.name);
      await logAudit(env, user, `mailbox.${kind}`, m.code, n.note ?? undefined);
      return json({ ok: true, notice: n });
    } else if (b.action === 'note') {
      await updateMailbox(env, m.code, { notes: String(b.notes ?? '').trim().slice(0, 500) || null });
      await logAudit(env, user, 'mailbox.note', m.code);
    } else if (b.action === 'cancel') {
      const reason = String(b.reason ?? '').trim().slice(0, 200);
      if (!reason) throw new Error('A reason is needed to cancel');
      if (m.stripe_subscription_id) await cancelSubscription(env, m.stripe_subscription_id);
      await updateMailbox(env, m.code, { status: 'cancelled', cancelled_at: new Date().toISOString(), notes: [m.notes, `Cancelled: ${reason}`].filter(Boolean).join('\n') });
      await logAudit(env, user, 'mailbox.cancel', m.code, reason);
    } else return json({ error: 'Unknown action' }, 400);
    return json({ ok: true, mailbox: await getMailbox(env, m.code) });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
