export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { recordDropoff, findDropoffs, recentDropoffs, markDropoffsHanded, carrierFromBarcode, getDropoff, queuePrint, type Dropoff } from '../../shipping/store';
import { dropoffReceiptZpl, dropoffReceiptText } from '../../shipping/receipt';
import { sendSms, normalizePhone } from '../../shipping/notify';

// Drop-off capture from /counter/dropoff. Staff PIN required.
// A customer hands over a prepaid or return package; staff scan its barcode and we keep a record with
// the time, so "I dropped it off and it never moved" has an answer. Rate Pro does this and it matters.
// With receipt: true the slip is queued for the counter printer; with text: true and a mobile number
// the same receipt goes as a text. "receipt" and "text" on their own re-send for an earlier drop-off.
async function receipt(env: Env, d: Dropoff, print: boolean, text: boolean) {
  const out: { printed?: number; agent?: boolean; texted?: boolean; text_mock?: boolean } = {};
  if (print) {
    out.printed = await queuePrint(env, { shipment_id: null, kind: 'receipt', payload: btoa(unescape(encodeURIComponent(dropoffReceiptZpl(d)))), printer: 'counter' });
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
  if (!env.COUNTER_PIN || String(b.pin) !== env.COUNTER_PIN) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'accept') {
      const barcode = String(b.barcode ?? '').replace(/\s+/g, '');
      if (barcode.length < 8 || barcode.length > 40) return json({ error: 'That does not look like a tracking barcode' }, 400);
      const before = await findDropoffs(env, barcode);
      const d = await recordDropoff(env, { barcode, carrier: b.carrier || carrierFromBarcode(barcode), customer_name: b.customer_name, customer_phone: b.customer_phone, accepted_by: b.staff, notes: b.notes });
      const r = await receipt(env, d, b.receipt === true || b.receipt === 'on', b.text === true || b.text === 'on').catch((e) => ({ error: String(e.message) }));
      return json({ ok: true, dropoff: d, duplicate: before.length > 0, receipt: r });
    }
    if (b.action === 'get' || b.action === 'receipt' || b.action === 'text') {
      const d = await getDropoff(env, Number(b.id));
      if (!d) return json({ error: 'No such drop-off' }, 404);
      if (b.action === 'get') return json({ dropoff: d, zpl: dropoffReceiptZpl(d), text: dropoffReceiptText(d) });
      return json({ ok: true, receipt: await receipt(env, d, b.action === 'receipt', b.action === 'text') });
    }
    if (b.action === 'lookup') return json({ dropoffs: await findDropoffs(env, String(b.barcode ?? '')) });
    if (b.action === 'recent') return json({ dropoffs: await recentDropoffs(env) });
    if (b.action === 'handed') return json({ ok: true, count: await markDropoffsHanded(env, String(b.carrier ?? '')) });
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
