export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { listNotes, addNote, logAudit } from '../../shipping/store';

// Notes on a customer or an order, from the customer page and the order page. Any staff member.
//  list: { kind: "customer" | "order", target } newest first.
//  add:  { kind, target, note } with the signed-in name; also written to the audit log.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  const kind = String(b.kind ?? '');
  const target = String(b.target ?? '').trim().slice(0, 40);
  if (!['customer', 'order'].includes(kind) || !target) return json({ error: 'kind and target are needed' }, 400);
  try {
    if (b.action === 'list') return json({ notes: await listNotes(env, kind as 'customer' | 'order', target) });
    if (b.action === 'add') {
      const note = String(b.note ?? '').trim().slice(0, 500);
      if (!note) return json({ error: 'Type the note first' }, 400);
      const row = await addNote(env, { kind: kind as 'customer' | 'order', target, note, by_name: user.name });
      await logAudit(env, user, `note.${kind}`, target, note.slice(0, 120));
      return json({ ok: true, note: row });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
