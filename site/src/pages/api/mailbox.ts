export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { priceMailbox, newMailboxCode } from '../../lib/mailboxes';
import { createMailbox, getMailbox, updateMailbox, logAudit, upsertCustomer, addMailboxItem, getMailboxItem, getMailboxItemByPhoto, updateMailboxItem, MAILBOX_ITEM_STATUSES } from '../../shipping/store';
import { saveImage, readImage, saveScan } from '../../lib/photos';
import { createMailboxCheckout, cancelSubscription } from '../../lib/stripe';
import { notifyMailbox, KINDS, type NoticeKind } from '../../lib/mailboxNotify';

// Mailbox subscriptions. POST: a customer picks a size and a term on /mailbox and goes to Stripe
// Checkout in subscription mode. PUT: staff actions from /counter/mailbox/CODE (box number, Form
// 1583, notes, cancel, and the mail log: item, item_status), PIN required and audited. GET ?photo=ID serves a
// mail-log photo; the id is 32 random hex characters, the only protection an <img> tag can carry, the same
// rule as intake photos.
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
    } else if (b.action === 'item') {
      // The mail log (T33): one row per piece, with a photo when staff took one. The holder sees it signed in on
      // /account. notify (default on) also sends the T12 text and email, with a link to the account page.
      if (m.status === 'cancelled') throw new Error('This mailbox is cancelled');
      const kind = (['letter', 'package', 'magazine', 'other'] as const).find((k) => k === b.kind) ?? 'letter';
      const sender = String(b.sender ?? '').trim().slice(0, 80) || null;
      const note = String(b.note ?? '').trim().slice(0, 200) || null;
      const img = String(b.image ?? '');
      const photo = img ? await saveImage(env, img) : null;
      const notify = b.notify !== false && b.notify !== 'false' && b.notify !== 0;
      const item = await addMailboxItem(env, { mailbox_code: m.code, kind, sender, note, photo_id: photo?.id ?? null, photo_type: photo?.type ?? null, arrived_by: user.name, notified: notify ? 1 : 0 });
      let notice = null;
      if (notify) {
        const nk = kind === 'package' ? 'package' : kind === 'other' ? 'other' : 'mail';
        notice = await notifyMailbox(env, m, nk, [sender ? `from ${sender}` : '', note].filter(Boolean).join(', ').slice(0, 120), user.name, `${env.SITE_URL}/account`);
      }
      await logAudit(env, user, 'mailbox.item', m.code, `${item.id} ${kind}${sender ? ` from ${sender}` : ''}${photo ? ', photo' : ''}${notify ? ', notified' : ''}`);
      return json({ ok: true, item, notice });
    } else if (b.action === 'scan') {
      // Open-and-scan (v1.76.0): the contents of one piece, as an image or PDF, for the holder's account page. With or without
      // a request from the holder. The holder is told by text and email; the fee is SCAN_FEE, taken at the counter or on the statement.
      const id = Number(b.id);
      const it = await getMailboxItem(env, id);
      if (!it || it.mailbox_code !== m.code) throw new Error('No such item in this box');
      const scan = await saveScan(env, String(b.image ?? ''));
      const row = await updateMailboxItem(env, id, { scan_id: scan.id, scan_type: scan.type, scanned_at: new Date().toISOString(), scanned_by: user.name, scan_requested_at: it.scan_requested_at ?? new Date().toISOString() });
      let notice = null;
      if (b.notify !== false && b.notify !== 'false') notice = await notifyMailbox(env, m, 'other', `scan ready${it.sender ? ` of the ${it.kind} from ${it.sender}` : ''}`, user.name, `${env.SITE_URL}/account`);
      await logAudit(env, user, 'mailbox.item.scan', m.code, `${id} ${scan.type} ${scan.bytes} bytes`);
      return json({ ok: true, item: row, notice });
    } else if (b.action === 'item_status') {
      const id = Number(b.id);
      const status = (MAILBOX_ITEM_STATUSES as readonly string[]).includes(b.status) ? (b.status as typeof MAILBOX_ITEM_STATUSES[number]) : null;
      if (!status) throw new Error('Pick a status');
      const it = await getMailboxItem(env, id);
      if (!it || it.mailbox_code !== m.code) throw new Error('No such item in this box');
      const closed = status !== 'arrived';
      const row = await updateMailboxItem(env, id, { status, closed_at: closed ? new Date().toISOString() : null, closed_by: closed ? user.name : null });
      await logAudit(env, user, `mailbox.item.${status}`, m.code, String(id));
      return json({ ok: true, item: row });
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

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('photo') ?? '';
  const it = await getMailboxItemByPhoto(env, id);
  const bytes = it ? await readImage(env, id) : null;
  if (!it || !bytes) return new Response('Not found', { status: 404 });
  const type = it.scan_id === id ? it.scan_type ?? 'application/pdf' : it.photo_type ?? 'image/jpeg';
  return new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Robots-Tag': 'noindex' } });
};
