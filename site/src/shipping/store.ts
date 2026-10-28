// PeterShip's own records: shipments, tracking events, the print queue and drop-offs, in Cloudflare D1.
// Orders still live in KV (that is what the customer pages read); every bought label is also written
// here, which is what tracking, the printer agent, drop-offs and the reports in agenda item 36 read.
// Without a D1 binding (plain `npm run dev`) everything falls back to memory so the pages still work.
import type { Label, TrackingEvent } from './types';
import type { Order } from '../lib/orders';

export interface ShipmentRow {
  id: string;
  customer_id?: string | null;
  carrier: string;
  service: string;
  rate_id: string;
  provider: string;
  origin_json: string;
  destination_json: string;
  parcel_json: string;
  billable_weight_lb: number | null;
  cost: number;
  price: number;
  tax: number;
  paid_via: string | null;
  tracking_number: string | null;
  label_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PrintJob {
  id: number;
  shipment_id: string | null;
  kind: 'label_zpl' | 'label_pdf' | 'receipt' | 'card_sheet';
  payload: string;
  printer: string;
  queued_at: string;
  printed_at: string | null;
}

export interface Dropoff {
  id: number;
  barcode: string;
  carrier: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  accepted_by: string | null;
  accepted_at: string;
  handed_to_carrier_at: string | null;
  notes: string | null;
}

/** Guess the carrier from a barcode or tracking number. Good enough for drop-offs; the carrier confirms on scan. */
export function carrierFromBarcode(code: string): string | null {
  const c = code.replace(/\s+/g, '').toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/.test(c)) return 'UPS';
  if (/^(9[2-5]\d{20,24}|420\d{27,31}|[A-Z]{2}\d{9}US)$/.test(c)) return 'USPS';
  if (/^(\d{12}|\d{15}|\d{20}|96\d{20})$/.test(c)) return 'FedEx';
  if (/^(\d{10}|JD\d{18}|JJD\d{16,18})$/.test(c)) return 'DHL';
  return null;
}

const now = () => new Date().toISOString();

// ---- memory fallback -------------------------------------------------------------------------
const mem = {
  contacts: new Map<string, Contacts>(),
  notified: new Set<string>(),
  shipments: new Map<string, ShipmentRow>(),
  events: new Map<string, (TrackingEvent & { id: number })[]>(),
  jobs: [] as PrintJob[],
  dropoffs: [] as Dropoff[],
  quotes: new Map<string, QuoteRow>(),
  customers: new Map<string, CustomerRow>(),
  rules: [] as { id: number; scope: string; match: string | null; percent: number | null; flat: number | null; price: number | null; active: number; updated_at: string }[],
  addons: [] as RawAddonRow[],
  orderAddons: [] as { order_id: string; code: string; name: string; qty: number; unit_price: number; total: number; created_at: string }[],
  staff: [] as StaffRow[],
  audit: [] as AuditRow[],
  invoices: [] as InvoiceRow[],
  invoiceLines: [] as InvoiceLineRow[],
  seq: 1,
};

// ---- carrier invoice audits ----------------------------------------------------------------------
export interface InvoiceRow { id: number; carrier: string; label: string; uploaded_at: string; uploaded_by: string; line_count: number; billed_total: number; expected_total: number; flagged_total: number }
export interface InvoiceLineRow { id: number; invoice_id: number; tracking: string; shipment_id: string | null; carrier: string | null; service: string | null; billed: number; expected: number | null; variance: number | null; status: string; description: string | null; line_date: string | null; disputed: number; note: string | null }

/** Shipments keyed by normalized tracking number, for a list of numbers, in chunks D1 can bind. */
export async function shipmentsByTracking(env: Env, trackings: string[]): Promise<Map<string, ShipmentRow>> {
  const want = [...new Set(trackings.map((t) => t.replace(/\s+/g, '').toUpperCase()).filter(Boolean))];
  const out = new Map<string, ShipmentRow>();
  if (env.DB) {
    for (let i = 0; i < want.length; i += 80) {
      const chunk = want.slice(i, i + 80);
      const r = await env.DB.prepare(`SELECT * FROM shipments WHERE REPLACE(UPPER(tracking_number), ' ', '') IN (${chunk.map((_, k) => `?${k + 1}`).join(',')})`).bind(...chunk).all<ShipmentRow>();
      for (const s of r.results) out.set((s.tracking_number ?? '').replace(/\s+/g, '').toUpperCase(), s);
    }
    return out;
  }
  const set = new Set(want);
  for (const s of mem.shipments.values()) { const k = (s.tracking_number ?? '').replace(/\s+/g, '').toUpperCase(); if (set.has(k)) out.set(k, s); }
  return out;
}

export async function recentShipments(env: Env, limit = 40): Promise<ShipmentRow[]> {
  if (env.DB) return (await env.DB.prepare(`SELECT * FROM shipments WHERE tracking_number IS NOT NULL ORDER BY created_at DESC LIMIT ${limit}`).all<ShipmentRow>()).results;
  return [...mem.shipments.values()].filter((s) => s.tracking_number).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function saveInvoice(env: Env, inv: { carrier: string; label: string; uploaded_by: string; lines: Omit<InvoiceLineRow, 'id' | 'invoice_id' | 'disputed' | 'note'>[]; summary: { lines: number; billed: number; expected: number; overcharged_amount: number } }): Promise<InvoiceRow> {
  const row: Omit<InvoiceRow, 'id'> = { carrier: inv.carrier, label: inv.label, uploaded_at: now(), uploaded_by: inv.uploaded_by, line_count: inv.summary.lines, billed_total: inv.summary.billed, expected_total: inv.summary.expected, flagged_total: inv.summary.overcharged_amount };
  if (env.DB) {
    const r = await env.DB.prepare('INSERT INTO invoices (carrier, label, uploaded_at, uploaded_by, line_count, billed_total, expected_total, flagged_total) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id')
      .bind(row.carrier, row.label, row.uploaded_at, row.uploaded_by, row.line_count, row.billed_total, row.expected_total, row.flagged_total).first<{ id: number }>();
    const id = r!.id;
    const ins = env.DB.prepare('INSERT INTO invoice_lines (invoice_id, tracking, shipment_id, carrier, service, billed, expected, variance, status, description, line_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)');
    for (let i = 0; i < inv.lines.length; i += 100) await env.DB.batch(inv.lines.slice(i, i + 100).map((l) => ins.bind(id, l.tracking, l.shipment_id, l.carrier, l.service, l.billed, l.expected, l.variance, l.status, l.description, l.line_date)));
    return { id, ...row };
  }
  const id = mem.seq++;
  mem.invoices.unshift({ id, ...row });
  for (const l of inv.lines) mem.invoiceLines.push({ id: mem.seq++, invoice_id: id, ...l, disputed: 0, note: null });
  return { id, ...row };
}

export async function listInvoices(env: Env): Promise<InvoiceRow[]> {
  if (env.DB) return (await env.DB.prepare('SELECT * FROM invoices ORDER BY id DESC LIMIT 100').all<InvoiceRow>()).results;
  return mem.invoices.slice(0, 100);
}

export async function getInvoice(env: Env, id: number): Promise<(InvoiceRow & { lines: InvoiceLineRow[]; summary: { lines: number; billed: number; expected: number; variance: number; over: number; under: number; unknown: number; voided: number; duplicate: number; match: number; overcharged_amount: number } }) | null> {
  let inv: InvoiceRow | null; let lines: InvoiceLineRow[];
  if (env.DB) {
    inv = (await env.DB.prepare('SELECT * FROM invoices WHERE id = ?1').bind(id).first<InvoiceRow>()) ?? null;
    if (!inv) return null;
    lines = (await env.DB.prepare('SELECT * FROM invoice_lines WHERE invoice_id = ?1 ORDER BY id').bind(id).all<InvoiceLineRow>()).results;
  } else {
    inv = mem.invoices.find((x) => x.id === id) ?? null;
    if (!inv) return null;
    lines = mem.invoiceLines.filter((l) => l.invoice_id === id);
  }
  const order: Record<string, number> = { voided: 0, duplicate: 1, over: 2, unknown: 3, under: 4, match: 5 };
  lines.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || Math.abs(b.variance ?? 0) - Math.abs(a.variance ?? 0));
  const count = (st: string) => lines.filter((l) => l.status === st).length;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { ...inv, lines, summary: { lines: lines.length, billed: inv.billed_total, expected: inv.expected_total, variance: r2(inv.billed_total - inv.expected_total), over: count('over'), under: count('under'), unknown: count('unknown'), voided: count('voided'), duplicate: count('duplicate'), match: count('match'), overcharged_amount: inv.flagged_total } };
}

export async function disputeLine(env: Env, invoiceId: number, lineId: number, disputed: boolean, note: string): Promise<boolean> {
  if (env.DB) {
    const r = await env.DB.prepare('UPDATE invoice_lines SET disputed = ?3, note = ?4 WHERE id = ?2 AND invoice_id = ?1').bind(invoiceId, lineId, disputed ? 1 : 0, note || null).run();
    return (r.meta.changes ?? 0) > 0;
  }
  const l = mem.invoiceLines.find((x) => x.id === lineId && x.invoice_id === invoiceId);
  if (!l) return false;
  l.disputed = disputed ? 1 : 0; l.note = note || null;
  return true;
}

// ---- staff and the audit log --------------------------------------------------------------------
export interface StaffRow { id: number; name: string; pin_hash: string; role: string; active: number }
export interface AuditRow { id: number; at: string; staff_id: number | null; staff_name: string; action: string; target: string | null; detail: string | null }

export async function listStaff(env: Env): Promise<StaffRow[]> {
  if (env.DB) return (await env.DB.prepare('SELECT * FROM staff ORDER BY active DESC, name').all<StaffRow>()).results;
  return [...mem.staff].sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
}

export async function addStaff(env: Env, s: { name: string; pin_hash: string; role: string }): Promise<StaffRow> {
  if (env.DB) {
    const r = await env.DB.prepare('INSERT INTO staff (name, pin_hash, role, active) VALUES (?1, ?2, ?3, 1) RETURNING id').bind(s.name, s.pin_hash, s.role).first<{ id: number }>();
    return { id: r!.id, ...s, active: 1 };
  }
  const row = { id: mem.seq++, ...s, active: 1 };
  mem.staff.push(row);
  return row;
}

export async function updateStaff(env: Env, id: number, patch: { name?: string; role?: string; active?: number; pin_hash?: string }) {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  if (env.DB) {
    await env.DB.prepare(`UPDATE staff SET ${keys.map((k, i) => `${k} = ?${i + 2}`).join(', ')} WHERE id = ?1`).bind(id, ...keys.map((k) => patch[k])).run();
    return;
  }
  const s = mem.staff.find((x) => x.id === id);
  if (s) Object.assign(s, patch);
}

/** One line in the audit log. Never throws: a logging failure must not block the action it describes. */
export async function logAudit(env: Env, who: { id: number | null; name: string }, action: string, target?: string | null, detail?: string | null) {
  try {
    const row = { at: now(), staff_id: who.id, staff_name: who.name, action, target: target ?? null, detail: detail ? String(detail).slice(0, 300) : null };
    if (env.DB) await env.DB.prepare('INSERT INTO audit_log (at, staff_id, staff_name, action, target, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(row.at, row.staff_id, row.staff_name, row.action, row.target, row.detail).run();
    else mem.audit.unshift({ id: mem.seq++, ...row });
  } catch (e) { console.error('audit log failed', e); }
}

export async function listAudit(env: Env, o: { staff_id?: number; limit?: number } = {}): Promise<AuditRow[]> {
  const limit = Math.min(500, o.limit ?? 200);
  if (env.DB) {
    if (o.staff_id) return (await env.DB.prepare(`SELECT * FROM audit_log WHERE staff_id = ?1 ORDER BY id DESC LIMIT ${limit}`).bind(o.staff_id).all<AuditRow>()).results;
    return (await env.DB.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ${limit}`).all<AuditRow>()).results;
  }
  return mem.audit.filter((a) => !o.staff_id || a.staff_id === o.staff_id).slice(0, limit);
}

// ---- add-ons and insurance ----------------------------------------------------------------------
// The catalog the owners edit at /counter/rules (boxes, packing, services) and the insurance terms,
// kept as rows of one table; lib/addons.ts prices against it. Until the first save the table is empty
// and the seed file stands in. order_addons holds what was actually sold, for the reports.
export interface AddonRow { code: string; kind: 'box' | 'packing' | 'service'; name: string; price: number; active: number; sort: number }
interface RawAddonRow extends Omit<AddonRow, 'kind'> { kind: string; updated_at: string }
export interface AddonsSaved { insurance: { included_usd: number; per_100_usd: number; minimum_usd: number; max_declared_usd: number }; items: AddonRow[]; updated_at: string | null }
const INS_KEYS = ['included_usd', 'per_100_usd', 'minimum_usd', 'max_declared_usd'] as const;
let addonsCache: { at: number; value: AddonsSaved | null } | null = null;

export async function loadAddons(env: Env, fresh = false): Promise<AddonsSaved | null> {
  if (!fresh && addonsCache && Date.now() - addonsCache.at < RULES_TTL) return addonsCache.value;
  const rows: RawAddonRow[] = env.DB ? (await env.DB.prepare('SELECT * FROM addons ORDER BY sort, code').all<RawAddonRow>()).results : mem.addons;
  let value: AddonsSaved | null = null;
  if (rows.length) {
    const setting = (k: string, d: number) => rows.find((r) => r.kind === 'setting' && r.code === k)?.price ?? d;
    value = {
      insurance: { included_usd: setting('included_usd', 100), per_100_usd: setting('per_100_usd', 1.25), minimum_usd: setting('minimum_usd', 2.75), max_declared_usd: setting('max_declared_usd', 5000) },
      items: rows.filter((r) => r.kind !== 'setting').map(({ code, kind, name, price, active, sort }) => ({ code, kind: kind as AddonRow['kind'], name, price, active, sort })),
      updated_at: rows.map((r) => r.updated_at).sort().pop() ?? null,
    };
  }
  addonsCache = { at: Date.now(), value };
  return value;
}

export async function saveAddons(env: Env, c: { insurance: AddonsSaved['insurance']; items: AddonRow[] }): Promise<AddonsSaved> {
  const t = now();
  const rows: RawAddonRow[] = [
    ...INS_KEYS.map((k) => ({ code: k, kind: 'setting', name: k, price: c.insurance[k], active: 1, sort: 0, updated_at: t })),
    ...c.items.map((i) => ({ ...i, kind: i.kind as string, active: i.active ? 1 : 0, updated_at: t })),
  ];
  if (env.DB) {
    const ins = env.DB.prepare('INSERT INTO addons (code, kind, name, price, active, sort, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)');
    await env.DB.batch([env.DB.prepare('DELETE FROM addons'), ...rows.map((r) => ins.bind(r.code, r.kind, r.name, r.price, r.active, r.sort, r.updated_at))]);
  } else {
    mem.addons = rows;
  }
  addonsCache = null;
  return (await loadAddons(env, true))!;
}

/** Record what was sold with a label, once, when the label is bought. */
export async function recordOrderAddons(env: Env, order: Order) {
  const lines = [...(order.addons ?? []).map((l) => ({ code: l.code, name: l.name, qty: l.qty, unit_price: l.unit_price, total: l.total })),
    ...(order.insurance ? [{ code: 'insurance', name: `Insurance to $${order.insurance.declared_usd}`, qty: 1, unit_price: order.insurance.fee, total: order.insurance.fee }] : [])];
  if (!lines.length) return;
  const t = now();
  if (env.DB) {
    const already = await env.DB.prepare('SELECT 1 FROM order_addons WHERE order_id = ?1 LIMIT 1').bind(order.id).first();
    if (already) return;
    const ins = env.DB.prepare('INSERT INTO order_addons (order_id, code, name, qty, unit_price, total, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)');
    await env.DB.batch(lines.map((l) => ins.bind(order.id, l.code, l.name, l.qty, l.unit_price, l.total, t)));
  } else {
    if (mem.orderAddons.some((l) => l.order_id === order.id)) return;
    for (const l of lines) mem.orderAddons.push({ order_id: order.id, ...l, created_at: t });
  }
}

// ---- retail rules -----------------------------------------------------------------------------
// The markup between carrier cost and the price customers see, editable at /counter/rules without a
// deploy. Rows: scope "default" (one), "carrier" (match USPS, UPS, FedEx, DHL) or "service" (match the
// exact service name). The two switches live as rows too, scope "setting", match "enabled" or
// "round_to_99", so the table needs no second table and no new columns. Until the first save the
// table is empty and pricing.ts falls back to src/data/ratepro.json.
export interface RuleRow {
  id?: number;
  scope: 'default' | 'carrier' | 'service';
  match: string | null;
  percent: number | null;
  flat: number | null;
  price: number | null;
  active: number;
}
export interface RulesConfig { enabled: boolean; round_to_99: boolean; rules: RuleRow[]; updated_at: string | null }

interface RawRuleRow { id: number; scope: string; match: string | null; percent: number | null; flat: number | null; price: number | null; active: number; updated_at: string }

let rulesCache: { at: number; value: RulesConfig | null } | null = null;
const RULES_TTL = 60_000; // a saved change reaches every running copy of the site within a minute

/** The saved rules, or null when nothing has been saved yet. Cached for a minute per running instance. */
export async function loadRules(env: Env, fresh = false): Promise<RulesConfig | null> {
  if (!fresh && rulesCache && Date.now() - rulesCache.at < RULES_TTL) return rulesCache.value;
  let rows: RawRuleRow[];
  if (env.DB) rows = (await env.DB.prepare('SELECT * FROM retail_rules ORDER BY id').all<RawRuleRow>()).results;
  else rows = mem.rules;
  let value: RulesConfig | null = null;
  if (rows.length) {
    const setting = (k: string) => rows.find((r) => r.scope === 'setting' && r.match === k);
    value = {
      enabled: !!setting('enabled')?.active,
      round_to_99: !!setting('round_to_99')?.active,
      rules: rows.filter((r) => r.scope !== 'setting').map(({ id, scope, match, percent, flat, price, active }) => ({ id, scope: scope as RuleRow['scope'], match, percent, flat, price, active })),
      updated_at: rows.map((r) => r.updated_at).sort().pop() ?? null,
    };
  }
  rulesCache = { at: Date.now(), value };
  return value;
}

/** Replace every rule at once. The editor always sends the whole table, so there is no partial state. */
export async function saveRules(env: Env, c: { enabled: boolean; round_to_99: boolean; rules: RuleRow[] }): Promise<RulesConfig> {
  const t = now();
  const rows: Omit<RawRuleRow, 'id'>[] = [
    { scope: 'setting', match: 'enabled', percent: null, flat: null, price: null, active: c.enabled ? 1 : 0, updated_at: t },
    { scope: 'setting', match: 'round_to_99', percent: null, flat: null, price: null, active: c.round_to_99 ? 1 : 0, updated_at: t },
    ...c.rules.map((r) => ({ scope: r.scope, match: r.match, percent: r.percent, flat: r.flat, price: r.price, active: r.active ? 1 : 0, updated_at: t })),
  ];
  if (env.DB) {
    const ins = env.DB.prepare('INSERT INTO retail_rules (scope, match, percent, flat, price, active, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)');
    await env.DB.batch([env.DB.prepare('DELETE FROM retail_rules'), ...rows.map((r) => ins.bind(r.scope, r.match, r.percent, r.flat, r.price, r.active, r.updated_at))]);
  } else {
    mem.rules = rows.map((r, i) => ({ id: i + 1, ...r }));
  }
  rulesCache = null;
  return (await loadRules(env, true))!;
}

// ---- customers --------------------------------------------------------------------------------
// One row per person we can tell apart: matched on email, else on mobile number. A walk-up who gave
// neither gets no customer row (two "John Smith"s must not merge); they are still found by name
// through the quotes table. Written on every order save, read by /counter/customers.
export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  consent_sms: number;
  consent_email: number;
  signup_code: string | null;
  created_at: string;
  last_seen_at: string | null;
}

/** Digits only, US country code dropped, so 318-555-0100, (318) 555-0100 and +13185550100 all match. */
export function normalizePhone(p: string | null | undefined): string | null {
  const d = (p ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}
const normEmail = (e: string | null | undefined) => (e ?? '').trim().toLowerCase() || null;

function newCustomerId() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return 'C-' + Array.from(bytes, (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
}

export async function findCustomer(env: Env, email: string | null, phone: string | null): Promise<CustomerRow | null> {
  if (!email && !phone) return null;
  if (env.DB) {
    return (await env.DB.prepare('SELECT * FROM customers WHERE (?1 IS NOT NULL AND email = ?1) OR (?2 IS NOT NULL AND phone = ?2) ORDER BY last_seen_at DESC LIMIT 1').bind(email, phone).first<CustomerRow>()) ?? null;
  }
  return [...mem.customers.values()].find((c) => (email && c.email === email) || (phone && c.phone === phone)) ?? null;
}

/** Create or refresh the customer for an order. Returns the id, or null when there is nothing to match on. */
export async function upsertCustomer(env: Env, c: { name: string; email?: string | null; phone?: string | null; sms?: boolean }): Promise<string | null> {
  const email = normEmail(c.email), phone = normalizePhone(c.phone);
  if (!email && !phone) return null;
  const t = now();
  const existing = await findCustomer(env, email, phone);
  const row: CustomerRow = existing
    ? { ...existing, name: c.name.trim() || existing.name, email: existing.email ?? email, phone: existing.phone ?? phone, consent_sms: existing.consent_sms || (c.sms && phone ? 1 : 0), consent_email: existing.consent_email || (email ? 1 : 0), last_seen_at: t }
    : { id: newCustomerId(), name: c.name.trim() || 'Customer', email, phone, consent_sms: c.sms && phone ? 1 : 0, consent_email: email ? 1 : 0, signup_code: null, created_at: t, last_seen_at: t };
  if (env.DB) {
    await env.DB.prepare('INSERT OR REPLACE INTO customers (id, name, email, phone, consent_sms, consent_email, signup_code, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
      .bind(row.id, row.name, row.email, row.phone, row.consent_sms, row.consent_email, row.signup_code, row.created_at, row.last_seen_at).run();
  } else {
    mem.customers.set(row.id, row);
  }
  return row.id;
}

export interface CustomerHit extends CustomerRow { shipments: number; first_at: string | null; returning: boolean }

/** Search by any part of the name, the email, or the digits of a phone number. */
export async function searchCustomers(env: Env, q: string, limit = 50): Promise<{ customers: CustomerHit[]; unlinked: QuoteRow[] }> {
  const term = q.trim();
  if (!term) return { customers: [], unlinked: [] };
  const digits = term.replace(/\D/g, '');
  const like = `%${term.toLowerCase()}%`;
  let rows: CustomerRow[];
  let unlinked: QuoteRow[];
  if (env.DB) {
    // Fewer than three digits would match everyone, so the phone clause then gets a pattern no phone has.
    rows = (await env.DB.prepare(`SELECT * FROM customers WHERE LOWER(name) LIKE ?1 OR email LIKE ?1 OR phone LIKE ?2 ORDER BY last_seen_at DESC LIMIT ${limit}`).bind(like, digits.length >= 3 ? `%${digits}%` : 'x').all<CustomerRow>()).results;
    unlinked = (await env.DB.prepare(`SELECT * FROM quotes WHERE email IS NULL AND phone IS NULL AND LOWER(customer_name) LIKE ?1 ORDER BY created_at DESC LIMIT 20`).bind(like).all<QuoteRow>()).results;
  } else {
    rows = [...mem.customers.values()].filter((c) => c.name.toLowerCase().includes(term.toLowerCase()) || (c.email ?? '').includes(term.toLowerCase()) || (digits.length >= 3 && (c.phone ?? '').includes(digits)))
      .sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? '')).slice(0, limit);
    unlinked = [...mem.quotes.values()].filter((x) => !x.email && !x.phone && (x.customer_name ?? '').toLowerCase().includes(term.toLowerCase())).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
  }
  const customers = await Promise.all(rows.map(async (c) => {
    const h = await customerQuotes(env, c);
    const real = h.filter((x) => x.status !== 'cancelled' && x.status !== 'voided');
    return { ...c, shipments: real.length, first_at: real.length ? real[real.length - 1].created_at : null, returning: real.length > 1 };
  }));
  return { customers, unlinked };
}

/** Every quote that belongs to this customer, newest first, with the shipment's tracking status when a label was bought. */
export async function customerQuotes(env: Env, c: CustomerRow): Promise<(QuoteRow & { shipment_status: string | null; tracking_number: string | null })[]> {
  if (env.DB) {
    return (await env.DB.prepare(
      `SELECT q.*, s.status AS shipment_status, s.tracking_number FROM quotes q LEFT JOIN shipments s ON s.id = q.id
       WHERE (?1 IS NOT NULL AND LOWER(q.email) = ?1) OR (?2 IS NOT NULL AND q.phone = ?2) ORDER BY q.created_at DESC LIMIT 200`).bind(c.email, c.phone).all<QuoteRow & { shipment_status: string | null; tracking_number: string | null }>()).results;
  }
  return [...mem.quotes.values()].filter((q) => (c.email && (q.email ?? '').toLowerCase() === c.email) || (c.phone && q.phone === c.phone))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((q) => ({ ...q, shipment_status: mem.shipments.get(q.id)?.status ?? null, tracking_number: mem.shipments.get(q.id)?.tracking_number ?? null }));
}

export async function getCustomer(env: Env, id: string): Promise<CustomerRow | null> {
  if (env.DB) return (await env.DB.prepare('SELECT * FROM customers WHERE id = ?1').bind(id).first<CustomerRow>()) ?? null;
  return mem.customers.get(id) ?? null;
}

/** Everyone, for the CSV the owners paste next to the Coupon Counter: phone first, since that is what it keys on. */
export async function allCustomers(env: Env): Promise<CustomerHit[]> {
  const rows: CustomerRow[] = env.DB
    ? (await env.DB.prepare('SELECT * FROM customers ORDER BY last_seen_at DESC LIMIT 5000').all<CustomerRow>()).results
    : [...mem.customers.values()].sort((a, b) => (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? ''));
  return Promise.all(rows.map(async (c) => {
    const real = (await customerQuotes(env, c)).filter((x) => x.status !== 'cancelled' && x.status !== 'voided');
    return { ...c, shipments: real.length, first_at: real.length ? real[real.length - 1].created_at : null, returning: real.length > 1 };
  }));
}

// ---- counter queue ----------------------------------------------------------------------------
// One row per order, written on every saveOrder(). The queue page lists these oldest first; the order
// itself (addresses, parcel, label) is still read from KV by code.
export interface QuoteRow {
  id: string;
  source: 'online' | 'counter';
  status: string;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  carrier: string;
  service: string;
  price: number;
  destination: string;
  international: number;
  staff: string | null;
  created_at: string;
  updated_at: string;
}

export const OPEN_QUOTE_STATUSES = ['awaiting_payment', 'reserved', 'labeled'];

export async function upsertQuote(env: Env, order: Order) {
  const d = order.destination;
  const row: QuoteRow = {
    id: order.id, source: order.source ?? 'online', status: order.status,
    customer_name: order.name?.trim() || d.contact_name || null, email: normEmail(order.email), phone: normalizePhone(order.phone),
    carrier: order.rate.carrier, service: order.rate.service, price: order.total ?? order.rate.total_charge,
    destination: (order.kind === 'return'
      ? `Return from ${order.origin.city}, ${order.origin.state} to ${d.contact_name}`
      : `${d.contact_name}, ${d.city}, ${d.state} ${d.postal_code}${d.country_alpha2 !== 'US' ? ` ${d.country_alpha2}` : ''}`).replace(/\s+/g, ' ').trim(),
    international: order.international ? 1 : 0, staff: order.staff?.trim() || null,
    created_at: order.created_at, updated_at: now(),
  };
  if (env.DB) {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO quotes (id, source, status, customer_name, email, phone, carrier, service, price, destination, international, staff, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    ).bind(row.id, row.source, row.status, row.customer_name, row.email, row.phone, row.carrier, row.service, row.price, row.destination, row.international, row.staff, row.created_at, row.updated_at).run();
  } else {
    mem.quotes.set(row.id, row);
  }
  await upsertCustomer(env, { name: row.customer_name ?? '', email: row.email, phone: row.phone, sms: order.sms });
  return row;
}

/** What the counter sees: everything not yet printed, oldest first, then what was finished or dropped in the last day. */
export async function listQueue(env: Env): Promise<{ open: QuoteRow[]; done: QuoteRow[] }> {
  const since = new Date(Date.now() - DAY).toISOString();
  const marks = OPEN_QUOTE_STATUSES.map(() => '?').join(',');
  if (env.DB) {
    const open = (await env.DB.prepare(`SELECT * FROM quotes WHERE status IN (${marks}) ORDER BY created_at ASC LIMIT 200`).bind(...OPEN_QUOTE_STATUSES).all<QuoteRow>()).results;
    const done = (await env.DB.prepare(`SELECT * FROM quotes WHERE status NOT IN (${marks}) AND updated_at >= ? ORDER BY updated_at DESC LIMIT 50`).bind(...OPEN_QUOTE_STATUSES, since).all<QuoteRow>()).results;
    return { open, done };
  }
  const all = [...mem.quotes.values()];
  return {
    open: all.filter((q) => OPEN_QUOTE_STATUSES.includes(q.status)).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, 200),
    done: all.filter((q) => !OPEN_QUOTE_STATUSES.includes(q.status) && q.updated_at >= since).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 50),
  };
}

// ---- shipments --------------------------------------------------------------------------------
export async function recordShipment(env: Env, order: Order, label: Label, paidVia: 'stripe' | 'pos' | 'mock') {
  const t = now();
  const customer = await findCustomer(env, normEmail(order.email), normalizePhone(order.phone));
  const row: ShipmentRow = {
    id: order.id, customer_id: customer?.id ?? null,
    carrier: order.rate.carrier, service: order.rate.service, rate_id: order.rate.id, provider: order.rate.id.split(':')[0],
    origin_json: JSON.stringify(order.origin), destination_json: JSON.stringify(order.destination), parcel_json: JSON.stringify(order.parcel),
    billable_weight_lb: order.rate.billable_weight_lb ?? null,
    cost: label.cost || order.rate.cost, price: order.rate.total_charge, tax: 0, paid_via: paidVia,
    tracking_number: label.tracking_number, label_id: label.id, status: 'labeled', created_at: order.created_at, updated_at: t,
  };
  if (env.DB) {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO shipments (id, customer_id, carrier, service, rate_id, provider, origin_json, destination_json, parcel_json, billable_weight_lb, cost, price, tax, paid_via, tracking_number, label_id, status, created_at, updated_at)
       VALUES (?1, ?19, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`,
    ).bind(row.id, row.carrier, row.service, row.rate_id, row.provider, row.origin_json, row.destination_json, row.parcel_json, row.billable_weight_lb, row.cost, row.price, row.tax, row.paid_via, row.tracking_number, row.label_id, row.status, row.created_at, row.updated_at, row.customer_id).run();
  } else {
    mem.shipments.set(row.id, row);
  }
  await addTrackingEvents(env, row.id, [{ at: t, status: 'label_created', description: `Label created, ${row.service.toLowerCase().startsWith(row.carrier.toLowerCase()) ? row.service : `${row.carrier} ${row.service}`}` }]);
  await saveContacts(env, row.id, { email: order.email || null, phone: order.phone ?? null, sms_opt_in: !!order.sms && !!order.phone });
  return row;
}

/** Look a shipment up by its GP code or by tracking number. */
export async function findShipment(env: Env, q: string): Promise<ShipmentRow | null> {
  const code = q.trim().toUpperCase();
  const tracking = q.replace(/\s+/g, '').toUpperCase();
  if (env.DB) {
    return (await env.DB.prepare('SELECT * FROM shipments WHERE id = ?1 OR REPLACE(UPPER(tracking_number), " ", "") = ?2 LIMIT 1').bind(code, tracking).first<ShipmentRow>()) ?? null;
  }
  for (const s of mem.shipments.values()) if (s.id === code || (s.tracking_number ?? '').replace(/\s+/g, '').toUpperCase() === tracking) return s;
  return null;
}

export async function setShipmentStatus(env: Env, id: string, status: string) {
  if (env.DB) { await env.DB.prepare('UPDATE shipments SET status = ?2, updated_at = ?3 WHERE id = ?1').bind(id, status, now()).run(); return; }
  const s = mem.shipments.get(id);
  if (s) { s.status = status; s.updated_at = now(); }
}

/** Shipments that have not been delivered yet, oldest first; what the tracking poller and the staff exceptions list walk. */
export async function openShipments(env: Env, limit = 200): Promise<ShipmentRow[]> {
  const open = ['labeled', 'printed', 'in_transit', 'out_for_delivery', 'exception'];
  if (env.DB) {
    const r = await env.DB.prepare(`SELECT * FROM shipments WHERE status IN (${open.map(() => '?').join(',')}) ORDER BY updated_at ASC LIMIT ${limit}`).bind(...open).all<ShipmentRow>();
    return r.results;
  }
  return [...mem.shipments.values()].filter((s) => open.includes(s.status)).sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, limit);
}

// ---- tracking events --------------------------------------------------------------------------
/** Stores events not seen before and returns them (empty when nothing was new). */
export async function addTrackingEvents(env: Env, shipmentId: string, events: TrackingEvent[]): Promise<TrackingEvent[]> {
  if (!events.length) return [];
  const existing = await listTrackingEvents(env, shipmentId);
  const seen = new Set(existing.map((e) => `${e.at}|${e.status}|${e.description}`));
  const fresh = events.filter((e) => !seen.has(`${e.at}|${e.status}|${e.description}`));
  if (!fresh.length) return [];
  if (env.DB) {
    const stmt = env.DB.prepare('INSERT INTO tracking_events (shipment_id, at, status, description, location) VALUES (?1, ?2, ?3, ?4, ?5)');
    await env.DB.batch(fresh.map((e) => stmt.bind(shipmentId, e.at, e.status, e.description, e.location ?? null)));
  } else {
    const list = mem.events.get(shipmentId) ?? [];
    for (const e of fresh) list.push({ ...e, id: mem.seq++ });
    mem.events.set(shipmentId, list);
  }
  // The newest event drives the shipment's status, except that a label event never moves it backwards.
  const latest = [...fresh].sort((a, b) => b.at.localeCompare(a.at))[0];
  if (latest.status !== 'label_created' && latest.status !== 'unknown') await setShipmentStatus(env, shipmentId, latest.status);
  return fresh;
}

export async function listTrackingEvents(env: Env, shipmentId: string): Promise<TrackingEvent[]> {
  if (env.DB) {
    const r = await env.DB.prepare('SELECT at, status, description, location FROM tracking_events WHERE shipment_id = ?1 ORDER BY at DESC').bind(shipmentId).all<TrackingEvent>();
    return r.results.map((e) => ({ ...e, location: e.location ?? undefined }));
  }
  return [...(mem.events.get(shipmentId) ?? [])].sort((a, b) => b.at.localeCompare(a.at)).map(({ id, ...e }) => e);
}

// ---- print queue ------------------------------------------------------------------------------
export async function queuePrint(env: Env, job: Pick<PrintJob, 'shipment_id' | 'kind' | 'payload'> & { printer?: string }): Promise<number> {
  const printer = job.printer ?? 'counter';
  if (env.DB) {
    const r = await env.DB.prepare('INSERT INTO print_queue (shipment_id, kind, payload, printer, queued_at) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id').bind(job.shipment_id, job.kind, job.payload, printer, now()).first<{ id: number }>();
    return r!.id;
  }
  const j: PrintJob = { id: mem.seq++, shipment_id: job.shipment_id, kind: job.kind, payload: job.payload, printer, queued_at: now(), printed_at: null };
  mem.jobs.push(j);
  return j.id;
}

/** Oldest unprinted job for a printer. The agent calls this every few seconds. */
export async function nextPrintJob(env: Env, printer = 'counter'): Promise<PrintJob | null> {
  if (env.DB) return (await env.DB.prepare('SELECT * FROM print_queue WHERE printer = ?1 AND printed_at IS NULL ORDER BY id ASC LIMIT 1').bind(printer).first<PrintJob>()) ?? null;
  return mem.jobs.find((j) => j.printer === printer && !j.printed_at) ?? null;
}

export async function markPrinted(env: Env, id: number) {
  if (env.DB) { await env.DB.prepare('UPDATE print_queue SET printed_at = ?2 WHERE id = ?1 AND printed_at IS NULL').bind(id, now()).run(); return; }
  const j = mem.jobs.find((x) => x.id === id);
  if (j && !j.printed_at) j.printed_at = now();
}

export async function pendingPrintJobs(env: Env): Promise<PrintJob[]> {
  if (env.DB) return (await env.DB.prepare('SELECT * FROM print_queue WHERE printed_at IS NULL ORDER BY id ASC LIMIT 50').all<PrintJob>()).results;
  return mem.jobs.filter((j) => !j.printed_at);
}

// ---- drop-offs --------------------------------------------------------------------------------
export async function recordDropoff(env: Env, d: { barcode: string; carrier?: string | null; customer_name?: string; customer_phone?: string; accepted_by?: string; notes?: string }): Promise<Dropoff> {
  const row: Omit<Dropoff, 'id'> = {
    barcode: d.barcode.replace(/\s+/g, '').toUpperCase(), carrier: d.carrier ?? carrierFromBarcode(d.barcode),
    customer_name: d.customer_name?.trim() || null, customer_phone: d.customer_phone?.trim() || null,
    accepted_by: d.accepted_by?.trim() || null, accepted_at: now(), handed_to_carrier_at: null, notes: d.notes?.trim() || null,
  };
  if (env.DB) {
    const r = await env.DB.prepare('INSERT INTO dropoffs (barcode, carrier, customer_name, customer_phone, accepted_by, accepted_at, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id')
      .bind(row.barcode, row.carrier, row.customer_name, row.customer_phone, row.accepted_by, row.accepted_at, row.notes).first<{ id: number }>();
    return { id: r!.id, ...row };
  }
  const full = { id: mem.seq++, ...row };
  mem.dropoffs.unshift(full);
  return full;
}

export async function getDropoff(env: Env, id: number): Promise<Dropoff | null> {
  if (env.DB) return (await env.DB.prepare('SELECT * FROM dropoffs WHERE id = ?1').bind(id).first<Dropoff>()) ?? null;
  return mem.dropoffs.find((d) => d.id === id) ?? null;
}

export async function findDropoffs(env: Env, barcode: string): Promise<Dropoff[]> {
  const b = barcode.replace(/\s+/g, '').toUpperCase();
  if (env.DB) return (await env.DB.prepare('SELECT * FROM dropoffs WHERE barcode = ?1 ORDER BY id DESC').bind(b).all<Dropoff>()).results;
  return mem.dropoffs.filter((d) => d.barcode === b);
}

export async function recentDropoffs(env: Env, limit = 50): Promise<Dropoff[]> {
  if (env.DB) return (await env.DB.prepare(`SELECT * FROM dropoffs ORDER BY id DESC LIMIT ${limit}`).all<Dropoff>()).results;
  return mem.dropoffs.slice(0, limit);
}

/** End of day: every drop-off accepted today that is not yet marked as handed to its carrier. */
export async function markDropoffsHanded(env: Env, carrier: string): Promise<number> {
  const t = now();
  if (env.DB) {
    const r = await env.DB.prepare('UPDATE dropoffs SET handed_to_carrier_at = ?2 WHERE carrier = ?1 AND handed_to_carrier_at IS NULL').bind(carrier, t).run();
    return r.meta.changes ?? 0;
  }
  let n = 0;
  for (const d of mem.dropoffs) if (d.carrier === carrier && !d.handed_to_carrier_at) { d.handed_to_carrier_at = t; n++; }
  return n;
}

/** Bump updated_at without changing status, so a poll that found nothing new is not repeated right away. */
export async function touchShipment(env: Env, id: string) {
  if (env.DB) { await env.DB.prepare('UPDATE shipments SET updated_at = ?2 WHERE id = ?1').bind(id, now()).run(); return; }
  const s = mem.shipments.get(id);
  if (s) s.updated_at = now();
}

export interface ExceptionRow {
  id: string;
  carrier: string;
  service: string;
  tracking_number: string | null;
  status: string;
  to: string;
  created_at: string;
  last_event_at: string | null;
  last_description: string | null;
  reason: 'exception' | 'returned' | 'stuck' | 'not_scanned';
  days: number;
}

const DAY = 86_400_000;
/** Staff list of anything that needs a human: carrier exceptions, returns, no scan after a label, or no movement for a week. */
export async function listExceptions(env: Env): Promise<ExceptionRow[]> {
  const open = await openShipments(env, 500);
  const rows: ExceptionRow[] = [];
  for (const s of open) {
    const events = await listTrackingEvents(env, s.id);
    const moving = events.filter((e) => e.status !== 'label_created');
    const last = moving[0] ?? events[0] ?? null;
    const since = new Date(last?.at ?? s.created_at).getTime();
    const days = Math.floor((Date.now() - since) / DAY);
    let reason: ExceptionRow['reason'] | null = null;
    if (s.status === 'exception') reason = 'exception';
    else if (s.status === 'returned') reason = 'returned';
    else if (!moving.length && days >= 3) reason = 'not_scanned';
    else if (moving.length && days >= 7) reason = 'stuck';
    if (!reason) continue;
    const d = JSON.parse(s.destination_json);
    rows.push({ id: s.id, carrier: s.carrier, service: s.service, tracking_number: s.tracking_number, status: s.status, to: `${d.contact_name}, ${d.city}, ${d.state} ${d.postal_code}`.trim(), created_at: s.created_at, last_event_at: last?.at ?? null, last_description: last?.description ?? null, reason, days });
  }
  const order = { exception: 0, returned: 1, stuck: 2, not_scanned: 3 };
  return rows.sort((a, b) => order[a.reason] - order[b.reason] || b.days - a.days);
}

// ---- contacts and notifications --------------------------------------------------------------
export interface Contacts { email: string | null; phone: string | null; sms_opt_in: boolean }

export async function saveContacts(env: Env, shipmentId: string, c: Contacts) {
  if (env.DB) { await env.DB.prepare('INSERT OR REPLACE INTO shipment_contacts (shipment_id, email, phone, sms_opt_in) VALUES (?1, ?2, ?3, ?4)').bind(shipmentId, c.email, c.phone, c.sms_opt_in ? 1 : 0).run(); return; }
  mem.contacts.set(shipmentId, c);
}

export async function getContacts(env: Env, shipmentId: string): Promise<Contacts | null> {
  if (env.DB) {
    const r = await env.DB.prepare('SELECT email, phone, sms_opt_in FROM shipment_contacts WHERE shipment_id = ?1').bind(shipmentId).first<{ email: string | null; phone: string | null; sms_opt_in: number }>();
    return r ? { email: r.email, phone: r.phone, sms_opt_in: !!r.sms_opt_in } : null;
  }
  return mem.contacts.get(shipmentId) ?? null;
}

export async function notificationSent(env: Env, shipmentId: string, status: string): Promise<boolean> {
  if (env.DB) return !!(await env.DB.prepare('SELECT 1 FROM notifications WHERE shipment_id = ?1 AND status = ?2').bind(shipmentId, status).first());
  return mem.notified.has(`${shipmentId}|${status}`);
}

export async function recordNotification(env: Env, shipmentId: string, status: string, channels: string) {
  if (env.DB) { await env.DB.prepare('INSERT OR IGNORE INTO notifications (shipment_id, status, channels, sent_at) VALUES (?1, ?2, ?3, ?4)').bind(shipmentId, status, channels, now()).run(); return; }
  mem.notified.add(`${shipmentId}|${status}`);
}

export async function getShipment(env: Env, id: string): Promise<ShipmentRow | null> {
  if (env.DB) return (await env.DB.prepare('SELECT * FROM shipments WHERE id = ?1').bind(id).first<ShipmentRow>()) ?? null;
  return mem.shipments.get(id) ?? null;
}

// ---- reports -----------------------------------------------------------------------------------
// Daily shipments and margin, by carrier, busiest hours, returning customers, drop-offs, and the
// rows needed to reconcile against each carrier's invoice. Dates are ISO day strings, inclusive.
export interface ReportLine { shipments: number; revenue: number; cost: number; margin: number }
export interface Report {
  from: string; to: string;
  total: ReportLine;
  by_day: (ReportLine & { day: string })[];
  by_carrier: (ReportLine & { carrier: string })[];
  by_service: (ReportLine & { carrier: string; service: string })[];
  by_hour: { hour: number; shipments: number }[];       // 0..23, shop local time is applied in the browser
  by_weekday: { weekday: number; shipments: number }[]; // 0 Sunday .. 6 Saturday
  status: { status: string; shipments: number }[];
  returning: { customers: number; returning: number; share: number };
  dropoffs: { carrier: string; count: number }[];
  addons: { lines: number; revenue: number; by_item: { name: string; qty: number; revenue: number }[] };
  rows: { id: string; created_at: string; carrier: string; service: string; tracking_number: string | null; provider: string; cost: number; price: number; paid_via: string | null; status: string; email: string | null }[];
}

export async function report(env: Env, from: string, to: string): Promise<Report> {
  const start = `${from}T00:00:00.000Z`, end = `${to}T23:59:59.999Z`;
  let rows: Report['rows'];
  let dropRows: { carrier: string | null }[];
  let emails: { email: string | null; n: number }[];
  let addonRows: { name: string; qty: number; total: number }[];
  if (env.DB) {
    addonRows = (await env.DB.prepare('SELECT name, qty, total FROM order_addons WHERE created_at BETWEEN ?1 AND ?2').bind(start, end).all<{ name: string; qty: number; total: number }>()).results;
    rows = (await env.DB.prepare(
      `SELECT s.id, s.created_at, s.carrier, s.service, s.tracking_number, s.provider, s.cost, s.price, s.paid_via, s.status, c.email
       FROM shipments s LEFT JOIN shipment_contacts c ON c.shipment_id = s.id
       WHERE s.created_at BETWEEN ?1 AND ?2 AND s.status != 'voided' ORDER BY s.created_at`).bind(start, end).all<Report['rows'][number]>()).results;
    dropRows = (await env.DB.prepare('SELECT carrier FROM dropoffs WHERE accepted_at BETWEEN ?1 AND ?2').bind(start, end).all<{ carrier: string | null }>()).results;
    emails = (await env.DB.prepare(`SELECT c.email, COUNT(*) AS n FROM shipment_contacts c JOIN shipments s ON s.id = c.shipment_id WHERE c.email IS NOT NULL AND s.status != 'voided' GROUP BY c.email`).all<{ email: string; n: number }>()).results;
  } else {
    addonRows = mem.orderAddons.filter((l) => l.created_at >= start && l.created_at <= end);
    rows = [...mem.shipments.values()].filter((s) => s.created_at >= start && s.created_at <= end && s.status !== 'voided').sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((s) => ({ id: s.id, created_at: s.created_at, carrier: s.carrier, service: s.service, tracking_number: s.tracking_number, provider: s.provider, cost: s.cost, price: s.price, paid_via: s.paid_via, status: s.status, email: mem.contacts.get(s.id)?.email ?? null }));
    dropRows = mem.dropoffs.filter((d) => d.accepted_at >= start && d.accepted_at <= end);
    const count = new Map<string, number>();
    for (const [id, c] of mem.contacts) if (c.email && mem.shipments.get(id)?.status !== 'voided') count.set(c.email, (count.get(c.email) ?? 0) + 1);
    emails = [...count].map(([email, n]) => ({ email, n }));
  }

  const line = (): ReportLine => ({ shipments: 0, revenue: 0, cost: 0, margin: 0 });
  const add = (l: ReportLine, r: Report['rows'][number]) => { l.shipments++; l.revenue += r.price; l.cost += r.cost; l.margin += r.price - r.cost; };
  const round = (l: ReportLine) => { l.revenue = +l.revenue.toFixed(2); l.cost = +l.cost.toFixed(2); l.margin = +l.margin.toFixed(2); return l; };
  const total = line();
  const byDay = new Map<string, ReportLine>(), byCarrier = new Map<string, ReportLine>(), byService = new Map<string, ReportLine>();
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, shipments: 0 }));
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, shipments: 0 }));
  const status = new Map<string, number>();
  for (const r of rows) {
    add(total, r);
    const day = r.created_at.slice(0, 10);
    add(byDay.get(day) ?? byDay.set(day, line()).get(day)!, r);
    add(byCarrier.get(r.carrier) ?? byCarrier.set(r.carrier, line()).get(r.carrier)!, r);
    const sk = `${r.carrier}|${r.service}`;
    add(byService.get(sk) ?? byService.set(sk, line()).get(sk)!, r);
    const d = new Date(r.created_at);
    byHour[d.getUTCHours()].shipments++;
    byWeekday[d.getUTCDay()].shipments++;
    status.set(r.status, (status.get(r.status) ?? 0) + 1);
  }
  const drops = new Map<string, number>();
  for (const d of dropRows) drops.set(d.carrier ?? 'Unknown', (drops.get(d.carrier ?? 'Unknown') ?? 0) + 1);
  const byItem = new Map<string, { qty: number; revenue: number }>();
  for (const l of addonRows) { const e = byItem.get(l.name) ?? { qty: 0, revenue: 0 }; e.qty += l.qty; e.revenue += l.total; byItem.set(l.name, e); }
  const inRange = new Set(rows.map((r) => r.email).filter(Boolean));
  const returning = emails.filter((e) => inRange.has(e.email) && e.n > 1).length;

  return {
    from, to,
    total: round(total),
    by_day: [...byDay].map(([day, l]) => ({ day, ...round(l) })),
    by_carrier: [...byCarrier].map(([carrier, l]) => ({ carrier, ...round(l) })).sort((a, b) => b.revenue - a.revenue),
    by_service: [...byService].map(([k, l]) => ({ carrier: k.split('|')[0], service: k.split('|')[1], ...round(l) })).sort((a, b) => b.shipments - a.shipments),
    by_hour: byHour, by_weekday: byWeekday,
    status: [...status].map(([status, shipments]) => ({ status, shipments })),
    returning: { customers: inRange.size, returning, share: inRange.size ? +(returning / inRange.size).toFixed(3) : 0 },
    dropoffs: [...drops].map(([carrier, count]) => ({ carrier, count })).sort((a, b) => b.count - a.count),
    addons: { lines: addonRows.length, revenue: +addonRows.reduce((a, l) => a + l.total, 0).toFixed(2), by_item: [...byItem].map(([name, e]) => ({ name, qty: e.qty, revenue: +e.revenue.toFixed(2) })).sort((a, b) => b.revenue - a.revenue) },
    rows,
  };
}
