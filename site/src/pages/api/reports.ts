export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { report } from '../../shipping/store';

// Staff reports. POST { pin, from, to } (ISO days, inclusive, at most 366 days) returns the report;
// add format: "csv" for the shipment rows as a spreadsheet, for reconciling against the carrier invoice.
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  if (!env.COUNTER_PIN || String(b.pin) !== env.COUNTER_PIN) return json({ error: 'Wrong PIN' }, 403);
  const today = new Date().toISOString().slice(0, 10);
  const to = DAY.test(b.to) ? b.to : today;
  const from = DAY.test(b.from) ? b.from : to;
  if (from > to || (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 > 366) return json({ error: 'Pick a range of up to a year, oldest day first' }, 400);
  try {
    const r = await report(env, from, to);
    if (b.format === 'csv') {
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const head = ['order', 'created_at', 'carrier', 'service', 'tracking_number', 'provider', 'cost', 'price', 'margin', 'paid_via', 'status', 'email'];
      const lines = [head.join(','), ...r.rows.map((x) => [x.id, x.created_at, x.carrier, x.service, x.tracking_number, x.provider, x.cost.toFixed(2), x.price.toFixed(2), (x.price - x.cost).toFixed(2), x.paid_via, x.status, x.email].map(esc).join(','))];
      return new Response(lines.join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="shipments-${from}-to-${to}.csv"` } });
    }
    return json(r);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
