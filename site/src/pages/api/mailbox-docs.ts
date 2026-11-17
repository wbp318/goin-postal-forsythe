export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate, atLeast } from '../../lib/auth';
import { getCustomer, listMailboxDocs, listAllMailboxes, logAudit } from '../../shipping/store';
import { saveDoc, openDoc, removeDoc, KINDS, docsReady, type DocKind } from '../../lib/mailboxDocs';
import { addMonths, day, endedOn, KEEP_MONTHS } from '../../lib/mailbox';

// Mailbox holders' documents (Peter, Nov 16 2026): photo IDs and the PS Form 1583, by customer.
// Any staff PIN: list {customer_id}, add {customer_id, kind, name, data (data URL), note}.
// Manager or owner PIN only: open {id} (returns the decrypted file; audited every time), delete {id}.
// The file is never served by URL: the page asks with the PIN and shows it from memory.

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 401);
  const canOpen = atLeast(user, 'manager');
  try {
    if (b.action === 'list') {
      const customer = await getCustomer(env, String(b.customer_id ?? ''));
      if (!customer) return json({ error: 'No such customer' }, 404);
      const today = day(new Date());
      const boxes = (await listAllMailboxes(env)).filter((x) => x.customer_id === customer.id);
      // When none of their boxes is still paid: the day the last one ended, and when to delete the files (a year on).
      const ends = boxes.map((x) => endedOn(x, today));
      const lastEnded = boxes.length && ends.every(Boolean) ? (ends as string[]).sort().at(-1)! : null;
      return json({
        customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
        docs: await listMailboxDocs(env, customer.id),
        can_open: canOpen, ready: docsReady(env), kinds: KINDS,
        boxes: boxes.map((x) => x.box_no),
        last_ended: lastEnded, delete_after: lastEnded ? addMonths(lastEnded, KEEP_MONTHS) : null,
      });
    }
    if (b.action === 'add') {
      const customer = await getCustomer(env, String(b.customer_id ?? ''));
      if (!customer) return json({ error: 'No such customer' }, 404);
      const kind = String(b.kind ?? '') as DocKind;
      if (!(KINDS as readonly string[]).includes(kind)) return json({ error: 'Pick what kind of document it is.' }, 400);
      const row = await saveDoc(env, { customer_id: customer.id, kind, name: String(b.name ?? ''), dataUrl: String(b.data ?? ''), note: String(b.note ?? '').trim(), by_name: user.name });
      await logAudit(env, user, 'mailbox.doc_add', customer.id, `${customer.name} · ${kind} · ${row.name} · ${row.bytes} bytes`);
      return json({ ok: true, doc: row });
    }
    if (b.action === 'open' || b.action === 'delete') {
      if (!canOpen) return json({ error: 'Only a manager or owner can open or delete documents.' }, 403);
      if (b.action === 'delete') {
        const row = await removeDoc(env, String(b.id ?? ''));
        if (!row) return json({ error: 'No such document' }, 404);
        await logAudit(env, user, 'mailbox.doc_delete', row.customer_id, `${row.kind} · ${row.name}`);
        return json({ ok: true });
      }
      const f = await openDoc(env, String(b.id ?? ''));
      if (!f) return json({ error: 'No such document' }, 404);
      await logAudit(env, user, 'mailbox.doc_open', f.row.customer_id, `${f.row.kind} · ${f.row.name}`);
      return json({ ok: true, name: f.row.name, content_type: f.row.content_type, data: b64(f.bytes) });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message ?? 'Try again' }, /must be|too big|not set up/.test(e?.message ?? '') ? 400 : 500);
  }
};
