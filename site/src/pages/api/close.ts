export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate, CAN } from '../../lib/auth';
import { buildClose, closeZpl, closeEscpos } from '../../lib/close';
import { saveClose, listCloses, getClose, queuePrint, logAudit } from '../../shipping/store';

// End-of-day close, from /counter/close. Any staff member can look; closing the day needs a manager
// or owner, so the frozen numbers carry a name that answers for them.
//  figures: { day, tz } the day's figures, live.
//  close:   { day, tz, note, print } freezes them with the name and the note; print: true also sends
//           the Z-report to the counter printer. A day can be closed again (a later close supersedes).
//  list:    past closes, newest first.  get: { id } one close.  zpl: { id } its Z-report for reprinting.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  const day = String(b.day ?? new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return json({ error: 'Day must be a real date, YYYY-MM-DD' }, 400);
  const tz = Math.max(-840, Math.min(840, Number(b.tz) || 0));
  try {
    if (b.action === 'figures') return json({ report: await buildClose(env, day, tz), user: { name: user.name, role: user.role } });
    if (b.action === 'close') {
      if (!CAN.audit(user)) return json({ error: 'Closing the day needs a manager or owner' }, 403);
      const report = await buildClose(env, day, tz);
      const note = String(b.note ?? '').trim().slice(0, 300);
      const zpl = closeZpl(report, user.name, note);
      const saved = await saveClose(env, { day, closed_by: user.name, note, report, zpl });
      let printed: number | null = null;
      if (b.print) printed = env.RECEIPT_FORMAT === 'escpos'
        ? await queuePrint(env, { shipment_id: null, kind: 'receipt_escpos', payload: btoa(closeEscpos(report, user.name, note)), printer: 'counter' })
        : await queuePrint(env, { shipment_id: null, kind: 'receipt', payload: btoa(unescape(encodeURIComponent(zpl))), printer: 'counter' });
      await logAudit(env, user, 'day.close', day, `POS ${report.pos_expected.toFixed(2)}, Stripe ${report.stripe_expected.toFixed(2)}, ${report.labels.count} labels, ${report.voided.length} voids${note ? `, note: ${note.slice(0, 60)}` : ''}`);
      return json({ ok: true, id: saved.id, report, printed, agent: !!env.PRINTER_KEY });
    }
    if (b.action === 'list') return json({ closes: await listCloses(env) });
    if (b.action === 'get') {
      const c = await getClose(env, Number(b.id));
      if (!c) return json({ error: 'No such close' }, 404);
      return json(c);
    }
    if (b.action === 'zpl') {
      const c = await getClose(env, Number(b.id));
      if (!c) return json({ error: 'No such close' }, 404);
      const printed = await queuePrint(env, { shipment_id: null, kind: 'receipt', payload: btoa(unescape(encodeURIComponent(c.zpl))), printer: 'counter' });
      await logAudit(env, user, 'day.reprint', c.day);
      return json({ ok: true, printed, agent: !!env.PRINTER_KEY });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
