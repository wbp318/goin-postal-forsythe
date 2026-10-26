export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { recordDropoff, findDropoffs, recentDropoffs, markDropoffsHanded, carrierFromBarcode } from '../../shipping/store';

// Drop-off capture from /counter/dropoff. Staff PIN required.
// A customer hands over a prepaid or return package; staff scan its barcode and we keep a record with
// the time, so "I dropped it off and it never moved" has an answer. Rate Pro does this and it matters.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  if (!env.COUNTER_PIN || String(b.pin) !== env.COUNTER_PIN) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'accept') {
      const barcode = String(b.barcode ?? '').replace(/\s+/g, '');
      if (barcode.length < 8 || barcode.length > 40) return json({ error: 'That does not look like a tracking barcode' }, 400);
      const before = await findDropoffs(env, barcode);
      const d = await recordDropoff(env, { barcode, carrier: b.carrier || carrierFromBarcode(barcode), customer_name: b.customer_name, customer_phone: b.customer_phone, accepted_by: b.staff, notes: b.notes });
      return json({ ok: true, dropoff: d, duplicate: before.length > 0 });
    }
    if (b.action === 'lookup') return json({ dropoffs: await findDropoffs(env, String(b.barcode ?? '')) });
    if (b.action === 'recent') return json({ dropoffs: await recentDropoffs(env) });
    if (b.action === 'handed') return json({ ok: true, count: await markDropoffsHanded(env, String(b.carrier ?? '')) });
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
