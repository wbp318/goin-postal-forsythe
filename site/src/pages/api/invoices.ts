export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate, CAN } from '../../lib/auth';
import { audit, sampleInvoiceCsv, normTracking, type InvoiceInput } from '../../lib/invoices';
import { shipmentsByTracking, saveInvoice, listInvoices, getInvoice, disputeLine, recentShipments, logAudit } from '../../shipping/store';

// Carrier invoice audit, from /counter/invoices. Manager or owner.
//  audit:   { carrier, label, rows: [{ tracking, billed, description?, date? }], save? } compares the rows
//           with our shipments and, with save: true, keeps the result so it can be worked and exported.
//  list:    past audits, newest first.
//  get:     { id } one audit with its lines.
//  dispute: { id, line, disputed, note } marks a line as sent to the carrier for credit (or clears it).
//  csv:     { id, flagged? } the lines as a spreadsheet, flagged only by default, to attach to the dispute.
//  sample:  a CSV built from our own recent shipments with a few deliberate overcharges, for trying it out.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  if (!CAN.audit(user)) return json({ error: 'Invoice audits are for managers and owners' }, 403);
  try {
    if (b.action === 'sample') {
      return new Response(sampleInvoiceCsv(await recentShipments(env, 40)), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="sample-carrier-invoice.csv"' } });
    }
    if (b.action === 'audit') {
      const rows: InvoiceInput[] = (Array.isArray(b.rows) ? b.rows : []).slice(0, 5000).map((r: any) => ({
        tracking: normTracking(r.tracking), billed: Number(String(r.billed ?? '').replace(/[$,\s]/g, '')), description: r.description ? String(r.description).slice(0, 80) : undefined, date: r.date ? String(r.date).slice(0, 20) : undefined,
      })).filter((r: InvoiceInput) => r.tracking && Number.isFinite(r.billed));
      if (!rows.length) throw new Error('No rows with a tracking number and an amount were found. Check the column choices.');
      const shipments = await shipmentsByTracking(env, rows.map((r) => r.tracking));
      const result = audit(rows, shipments, Number(b.tolerance) || 0.01);
      if (!b.save) return json({ ...result, saved: null });
      const carrier = String(b.carrier ?? '').slice(0, 10) || result.lines.find((l) => l.carrier)?.carrier || 'Unknown';
      const label = String(b.label ?? '').trim().slice(0, 60) || `${carrier} invoice ${new Date().toISOString().slice(0, 10)}`;
      const saved = await saveInvoice(env, { carrier, label, uploaded_by: user.name, lines: result.lines, summary: result.summary });
      await logAudit(env, user, 'invoice.import', String(saved.id), `${label}: ${result.summary.lines} lines, billed $${result.summary.billed.toFixed(2)}, flagged $${result.summary.overcharged_amount.toFixed(2)}`);
      return json({ ...result, saved: { id: saved.id, label, carrier } });
    }
    if (b.action === 'list') return json({ invoices: await listInvoices(env) });
    if (b.action === 'get') {
      const inv = await getInvoice(env, Number(b.id));
      if (!inv) return json({ error: 'No such invoice' }, 404);
      return json(inv);
    }
    if (b.action === 'dispute') {
      const ok = await disputeLine(env, Number(b.id), Number(b.line), !!b.disputed, String(b.note ?? '').slice(0, 200));
      if (!ok) return json({ error: 'No such line' }, 404);
      await logAudit(env, user, b.disputed ? 'invoice.dispute' : 'invoice.undispute', `${b.id}/${b.line}`, String(b.note ?? '').slice(0, 100) || null);
      return json({ ok: true });
    }
    if (b.action === 'csv') {
      const inv = await getInvoice(env, Number(b.id));
      if (!inv) return json({ error: 'No such invoice' }, 404);
      const flaggedOnly = b.flagged !== false;
      const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const out = [['tracking', 'our_order', 'carrier', 'service', 'billed', 'expected', 'variance', 'status', 'description', 'ship_date', 'disputed', 'note'].join(',')];
      for (const l of inv.lines) if (!flaggedOnly || l.status !== 'match') out.push([l.tracking, l.shipment_id, l.carrier, l.service, l.billed.toFixed(2), l.expected?.toFixed(2), l.variance?.toFixed(2), l.status, l.description, l.line_date, l.disputed ? 'yes' : 'no', l.note].map(esc).join(','));
      return new Response(out.join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="invoice-audit-${inv.id}.csv"` } });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, /No rows/.test(e.message ?? '') ? 400 : 500);
  }
};
