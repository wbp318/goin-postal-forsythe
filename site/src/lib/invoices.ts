// Carrier invoice audit. The carrier bills the store weekly; this matches every billed tracking number
// to the shipment we quoted and flags anything billed above the carrier cost we recorded: dimensional
// adjustments, address corrections, residential and fuel surcharges added after the fact, labels we
// voided but were still charged for, and tracking numbers that are not ours at all.
// The browser parses the CSV and sends plain rows; the matching happens here.
import type { ShipmentRow } from '../shipping/store';

export interface InvoiceInput { tracking: string; billed: number; description?: string; date?: string }
export type LineStatus = 'match' | 'over' | 'under' | 'unknown' | 'voided' | 'duplicate';
export interface InvoiceLine {
  tracking: string;
  shipment_id: string | null;
  carrier: string | null;
  service: string | null;
  billed: number;
  expected: number | null;
  variance: number | null;
  status: LineStatus;
  description: string | null;
  line_date: string | null;
}
export interface AuditResult {
  lines: InvoiceLine[];
  summary: { lines: number; billed: number; expected: number; variance: number; over: number; under: number; unknown: number; voided: number; duplicate: number; match: number; overcharged_amount: number };
}

export const normTracking = (t: string) => String(t ?? '').replace(/\s+/g, '').toUpperCase();
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Carrier invoices list a base charge and each surcharge on its own line; fold them into one line per tracking number. */
export function groupInvoice(rows: InvoiceInput[]): { grouped: Map<string, InvoiceInput & { count: number }>; duplicates: Set<string> } {
  const grouped = new Map<string, InvoiceInput & { count: number }>();
  const duplicates = new Set<string>();
  for (const r of rows) {
    const t = normTracking(r.tracking);
    if (!t || !Number.isFinite(r.billed)) continue;
    const g = grouped.get(t);
    if (g) {
      g.billed = r2(g.billed + r.billed);
      g.count++;
      if (r.description && !(g.description ?? '').includes(r.description)) g.description = [g.description, r.description].filter(Boolean).join(' + ');
      // The same base charge twice is a real duplicate; a base plus a surcharge is not.
      if (/base|postage|transportation|ground|priority|express|label/i.test(r.description ?? '') && /base|postage|transportation|ground|priority|express|label/i.test(g.description ?? '') && g.count > 1 && (g.description ?? '').split(' + ').length < g.count) duplicates.add(t);
    } else grouped.set(t, { ...r, tracking: t, billed: r2(r.billed), count: 1 });
  }
  return { grouped, duplicates };
}

/** Compare grouped invoice lines with our shipments. `tolerance` is how far billed may stray from cost before it is flagged. */
export function audit(rows: InvoiceInput[], shipments: Map<string, ShipmentRow>, tolerance = 0.01): AuditResult {
  const { grouped, duplicates } = groupInvoice(rows);
  const lines: InvoiceLine[] = [];
  for (const [t, g] of grouped) {
    const s = shipments.get(t);
    let status: LineStatus;
    let expected: number | null = null;
    let variance: number | null = null;
    if (!s) status = 'unknown';
    else {
      expected = r2(s.cost);
      variance = r2(g.billed - expected);
      if (s.status === 'voided') status = 'voided';
      else if (duplicates.has(t)) status = 'duplicate';
      else if (variance > tolerance) status = 'over';
      else if (variance < -tolerance) status = 'under';
      else status = 'match';
    }
    lines.push({ tracking: t, shipment_id: s?.id ?? null, carrier: s?.carrier ?? null, service: s?.service ?? null, billed: g.billed, expected, variance, status, description: g.description ?? null, line_date: g.date ?? null });
  }
  const order: Record<LineStatus, number> = { voided: 0, duplicate: 1, over: 2, unknown: 3, under: 4, match: 5 };
  lines.sort((a, b) => order[a.status] - order[b.status] || Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0));
  const sum = (f: (l: InvoiceLine) => number) => r2(lines.reduce((a, l) => a + f(l), 0));
  const count = (st: LineStatus) => lines.filter((l) => l.status === st).length;
  return {
    lines,
    summary: {
      lines: lines.length, billed: sum((l) => l.billed), expected: sum((l) => l.expected ?? 0), variance: sum((l) => l.variance ?? 0),
      over: count('over'), under: count('under'), unknown: count('unknown'), voided: count('voided'), duplicate: count('duplicate'), match: count('match'),
      overcharged_amount: sum((l) => (l.status === 'over' || l.status === 'duplicate' ? l.variance! : l.status === 'voided' ? l.billed : 0)),
    },
  };
}

/** Guess which CSV columns hold the tracking number, the amount, the description and the date, from the headers and a few values. */
export function guessColumns(headers: string[], sample: string[][]): { tracking: number; billed: number; description: number; date: number } {
  const h = headers.map((x) => x.toLowerCase());
  // Words are tried in order of preference, each against every header, so "net charge" beats "charge description".
  const find = (...words: string[]) => { for (const w of words) { const i = h.findIndex((x) => (w.length <= 3 ? new RegExp(`\\b${w}\\b`).test(x) : x.includes(w))); if (i >= 0) return i; } return -1; };
  let tracking = find('tracking', 'trk', 'pkg id', 'package id', 'airbill', 'awb', 'waybill', 'pic');
  if (tracking < 0) tracking = headers.findIndex((_, i) => sample.some((row) => /^(1Z[0-9A-Z]{16}|9[2-5]\d{20,24}|\d{12}|\d{15}|\d{10})$/.test(normTracking(row[i] ?? ''))));
  let billed = find('net charge', 'net amount', 'total charge', 'amount billed', 'billed', 'net', 'total', 'charge', 'amount');
  if (billed < 0) billed = headers.findIndex((_, i) => sample.every((row) => /^-?\$?\d+(\.\d+)?$/.test(String(row[i] ?? '').trim())));
  const description = find('description', 'charge type', 'charge description', 'service', 'detail', 'type');
  const date = find('invoice date', 'ship date', 'pickup date', 'date');
  return { tracking, billed, description, date };
}

/** A sample invoice built from our own shipments, with a few deliberate overcharges, so the audit can be tried before a real invoice exists. */
export function sampleInvoiceCsv(shipments: ShipmentRow[]): string {
  const lines = ['Tracking Number,Charge Description,Net Charge,Ship Date'];
  shipments.forEach((s, i) => {
    if (!s.tracking_number) return;
    const t = s.tracking_number.replace(/\s+/g, '');
    const day = s.created_at.slice(0, 10);
    lines.push(`${t},Base Charge,${s.cost.toFixed(2)},${day}`);
    if (i % 3 === 1) lines.push(`${t},Address Correction,18.00,${day}`);
    if (i % 4 === 2) lines.push(`${t},Additional Handling,4.50,${day}`);
    if (i % 5 === 3) lines.push(`${t},Base Charge,${s.cost.toFixed(2)},${day}`);
  });
  lines.push('1Z999AA10123456784,Base Charge,12.40,' + new Date().toISOString().slice(0, 10));
  return lines.join('\r\n') + '\r\n';
}
