export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { recordDropoff, findDropoffs, recentDropoffs, markDropoffsHanded, carrierFromBarcode, getDropoff, queuePrint, logAudit, listOpenReturns, getReturnRequest, markReturnServed, type Dropoff } from '../../shipping/store';
import { effectiveAddons, returnPrices } from '../../lib/addons';
import { dropoffReceiptZpl, dropoffReceiptText, dropoffReceiptEscpos } from '../../shipping/receipt';
import { sendSms, normalizePhone } from '../../shipping/notify';

// Drop-off capture from /counter/dropoff. Staff PIN required.
// A customer hands over a prepaid or return package; staff scan its barcode and we keep a record with
// the time, so "I dropped it off and it never moved" has an answer. Rate Pro does this and it matters.
// With receipt: true the slip is queued for the counter printer; with text: true and a mobile number
// the same receipt goes as a text. "receipt" and "text" on their own re-send for an earlier drop-off.
async function receipt(env: Env, d: Dropoff, print: boolean, text: boolean) {
  const out: { printed?: number; agent?: boolean; texted?: boolean; text_mock?: boolean } = {};
  if (print) {
    out.printed = env.RECEIPT_FORMAT === 'escpos'
      ? await queuePrint(env, { shipment_id: null, kind: 'receipt_escpos', payload: btoa(dropoffReceiptEscpos(d)), printer: 'counter' })
      : await queuePrint(env, { shipment_id: null, kind: 'receipt', payload: btoa(unescape(encodeURIComponent(dropoffReceiptZpl(d)))), printer: 'counter' });
    out.agent = !!env.PRINTER_KEY;
  }
  if (text && d.customer_phone && normalizePhone(d.customer_phone)) {
    out.text_mock = await sendSms(env, normalizePhone(d.customer_phone), dropoffReceiptText(d));
    out.texted = true;
  }
  return out;
}
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'accept') {
      const barcode = String(b.barcode ?? '').replace(/\s+/g, '');
      if (barcode.length < 8 || barcode.length > 40) return json({ error: 'That does not look like a tracking barcode' }, 400);
      const before = await findDropoffs(env, barcode);
      // A scan replayed from the page's offline outbox carries the time it was really scanned (up to seven days back).
      const scanned = typeof b.scanned_at === 'string' && !Number.isNaN(Date.parse(b.scanned_at)) && Date.now() - Date.parse(b.scanned_at) < 7 * 86_400_000 && Date.parse(b.scanned_at) <= Date.now() + 60_000 ? new Date(b.scanned_at).toISOString() : undefined;
      const d = await recordDropoff(env, { barcode, carrier: b.carrier || carrierFromBarcode(barcode), customer_name: b.customer_name, customer_phone: b.customer_phone, accepted_by: String(b.staff ?? '').trim() || user.name, notes: [b.notes, scanned ? 'scanned while offline' : ''].filter(Boolean).join('. ') || undefined, accepted_at: scanned });
      await logAudit(env, user, 'dropoff.accept', String(d.id), `${d.carrier ?? '?'} ${d.barcode}${d.customer_name ? `, ${d.customer_name}` : ''}`);
      // A returns request (RT- code from /returns) that this drop-off serves.
      const served = b.return_code ? await markReturnServed(env, String(b.return_code), d.id) : null;
      if (served) await logAudit(env, user, 'return.served', served.code, `drop-off ${d.id}`);
      const r = await receipt(env, d, b.receipt === true || b.receipt === 'on', b.text === true || b.text === 'on').catch((e) => ({ error: String(e.message) }));
      return json({ ok: true, dropoff: d, duplicate: before.length > 0, receipt: r, return_served: served?.code ?? null });
    }
    if (b.action === 'get' || b.action === 'receipt' || b.action === 'text') {
      const d = await getDropoff(env, Number(b.id));
      if (!d) return json({ error: 'No such drop-off' }, 404);
      if (b.action === 'get') return json({ dropoff: d, zpl: dropoffReceiptZpl(d), text: dropoffReceiptText(d) });
      await logAudit(env, user, b.action === 'receipt' ? 'dropoff.reprint' : 'dropoff.retext', String(d.id));
      return json({ ok: true, receipt: await receipt(env, d, b.action === 'receipt', b.action === 'text') });
    }
    if (b.action === 'lookup') return json({ dropoffs: await findDropoffs(env, String(b.barcode ?? '')) });
    if (b.action === 'returns') return json({ returns: await listOpenReturns(env), prices: returnPrices(await effectiveAddons(env)) });
    if (b.action === 'return') { const r = await getReturnRequest(env, String(b.code ?? '')); return r ? json({ request: r, prices: returnPrices(await effectiveAddons(env)) }) : json({ error: 'No such return request' }, 404); }
    if (b.action === 'return_served') { const r = await markReturnServed(env, String(b.code ?? ''), null); if (!r) return json({ error: 'No such return request' }, 404); await logAudit(env, user, 'return.served', r.code, 'without a scan'); return json({ ok: true, request: r }); }
    if (b.action === 'recent') return json({ dropoffs: await recentDropoffs(env) });
    if (b.action === 'handed') { const count = await markDropoffsHanded(env, String(b.carrier ?? '')); await logAudit(env, user, 'dropoff.handed', String(b.carrier ?? ''), `${count} packages`); return json({ ok: true, count }); }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
