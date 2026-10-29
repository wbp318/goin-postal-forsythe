// The store, run against its memory fallback (no D1, no KV): the same code paths the pages use,
// minus the SQL. Each describe builds its own records; the module's memory is shared, so ids are unique.
import { describe, it, expect } from 'vitest';
import * as store from '../src/shipping/store';
import type { Order } from '../src/lib/orders';
import type { Label } from '../src/shipping/types';

const env = {} as any;
const dest = { contact_name: 'Jane Doe', line_1: '1 Main St', city: 'Monroe', state: 'LA', postal_code: '71201', country_alpha2: 'US' } as any;
const parcel = { weight_lb: 2, length_in: 10, width_in: 8, height_in: 4, description: 'Books', value_usd: 30 };
const rate = (price = 9.65) => ({ id: 'easyship:mock-usps-ground', carrier: 'USPS' as const, service: 'USPS Ground Advantage', cost: price, total_charge: price, currency: 'USD', min_days: 2, max_days: 5, billable_weight_lb: 2 });
const label = (n: string): Label => ({ id: `easyship:${n}`, carrier: 'USPS', service: '', label_url: '/demo-label.html', label_zpl: null, qr_url: null, tracking_number: `9400${n.padStart(18, '0')}`, tracking_page_url: null, cost: 0 });
let seq = 100;
const order = (over: Partial<Order> = {}): Order => ({ id: `GP-T${++seq}`, status: 'reserved', created_at: new Date().toISOString(), email: '', origin: dest, destination: dest, parcel, rate: rate(), international: false, source: 'counter', ...over });

describe('customers and quotes', () => {
  it('normalizes phone and email, merges the same person, leaves name-only walk-ups unlinked', async () => {
    await store.upsertQuote(env, order({ name: 'Maria Lopez', phone: '(318) 555-0100', sms: true }));
    await store.upsertQuote(env, order({ name: 'Maria Lopez', phone: '+1 318 555 0100', email: 'Maria@Example.com' }));
    await store.upsertQuote(env, order({ name: 'Maria Lopez' }));
    const r = await store.searchCustomers(env, '555-01');
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0]).toMatchObject({ name: 'Maria Lopez', phone: '3185550100', email: 'maria@example.com', shipments: 2, returning: true, consent_sms: 1 });
    expect((await store.searchCustomers(env, 'lopez')).unlinked).toHaveLength(1);
  });
  it('the queue lists open quotes oldest first and moves finished ones under done', async () => {
    const a = order({ created_at: '2026-10-01T10:00:00Z' }); const b = order({ created_at: '2026-10-01T09:00:00Z' });
    await store.upsertQuote(env, a); await store.upsertQuote(env, b);
    const q = await store.listQueue(env);
    const ids = q.open.map((x) => x.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
    await store.upsertQuote(env, { ...a, status: 'cancelled' });
    const q2 = await store.listQueue(env);
    expect(q2.open.map((x) => x.id)).not.toContain(a.id);
    expect(q2.done.map((x) => x.id)).toContain(a.id);
  });
  it('a return and an account show in the queue row text', async () => {
    const o = order({ kind: 'return', origin: { ...dest, city: 'Dallas', state: 'TX' }, account_name: 'Bayou Candles', name: 'Lee' });
    const row = await store.upsertQuote(env, o);
    expect(row.destination).toBe('Return from Dallas, TX to Jane Doe');
    expect(row.customer_name).toBe('Bayou Candles: Lee');
  });
});

describe('shipments, add-ons, reports and the day', () => {
  it('records a shipment with its contacts and add-ons once, and the report adds them up', async () => {
    const o = order({ email: 'rep@example.com', addons: [{ code: 'box-m', name: 'Medium box', qty: 1, unit_price: 3.99, total: 3.99 }], insurance: { declared_usd: 650, fee: 7.5 }, total: 21.14 });
    await store.recordShipment(env, o, label('1'), 'pos');
    await store.recordOrderAddons(env, o); await store.recordOrderAddons(env, o); // idempotent
    const day = new Date().toISOString().slice(0, 10);
    const r = await store.report(env, day, day);
    expect(r.rows.some((x) => x.id === o.id && x.paid_via === 'pos' && x.email === 'rep@example.com')).toBe(true);
    expect(r.addons.lines).toBeGreaterThanOrEqual(2);
    expect(r.addons.by_item.find((i) => i.name === 'Medium box')?.qty).toBe(1);
  });
  it('voiding drops the shipment from the report and into the day figures refunds', async () => {
    const o = order({ total: 9.65 });
    await store.recordShipment(env, o, label('2'), 'pos');
    await store.setShipmentStatus(env, o.id, 'voided');
    const start = new Date(Date.now() - 3600_000).toISOString(), end = new Date(Date.now() + 3600_000).toISOString();
    const f = await store.dayFigures(env, start, end);
    expect(f.voided.some((v) => v.id === o.id && v.paid_via === 'pos' && v.total === 9.65)).toBe(true);
    expect(f.paid.pos).toBeGreaterThan(0);
  });
  it('tracking events move the status forward but a label event never moves it back', async () => {
    const o = order();
    await store.recordShipment(env, o, label('3'), 'stripe');
    await store.addTrackingEvents(env, o.id, [{ at: '2026-10-02T00:00:00Z', status: 'in_transit', description: 'Accepted' }]);
    expect((await store.getShipment(env, o.id))?.status).toBe('in_transit');
    const again = await store.addTrackingEvents(env, o.id, [{ at: '2026-10-02T00:00:00Z', status: 'in_transit', description: 'Accepted' }]);
    expect(again).toEqual([]);
    await store.addTrackingEvents(env, o.id, [{ at: '2026-10-03T00:00:00Z', status: 'label_created', description: 'late label event' }]);
    expect((await store.getShipment(env, o.id))?.status).toBe('in_transit');
  });
});

describe('staff, audit, rules, add-ons, notes, printer', () => {
  it('staff rows and the audit log', async () => {
    const s = await store.addStaff(env, { name: 'Sam', pin_hash: 'h1', role: 'counter' });
    await store.updateStaff(env, s.id, { role: 'manager' });
    expect((await store.listStaff(env)).find((x) => x.id === s.id)?.role).toBe('manager');
    await store.logAudit(env, { id: s.id, name: 'Sam' }, 'label.void', 'GP-X', 'Wrong ZIP');
    const a = await store.listAudit(env, { staff_id: s.id });
    expect(a[0]).toMatchObject({ staff_name: 'Sam', action: 'label.void', target: 'GP-X', detail: 'Wrong ZIP' });
  });
  it('rules and add-ons round-trip through save and load', async () => {
    expect(await store.loadRules(env, true)).toBeNull();
    const saved = await store.saveRules(env, { enabled: true, round_to_99: false, rules: [{ scope: 'default', match: null, percent: 20, flat: 1, price: null, active: 1 }] });
    expect(saved.enabled).toBe(true);
    expect(saved.rules[0]).toMatchObject({ scope: 'default', percent: 20 });
    const a = await store.saveAddons(env, { insurance: { included_usd: 100, per_100_usd: 1, minimum_usd: 2, max_declared_usd: 5000 }, online_fee: { percent: 2, flat: 0.25 }, sales_tax: { percent: 9.5 }, items: [{ code: 'box-s', kind: 'box', name: 'Small box', price: 2.99, active: 1, sort: 0 }] });
    expect(a.items[0].price).toBe(2.99);
    expect((await store.loadAddons(env, true))?.insurance.per_100_usd).toBe(1);
    expect((await store.loadAddons(env, true))?.online_fee).toEqual({ percent: 2, flat: 0.25 });
    expect((await store.loadAddons(env, true))?.sales_tax).toEqual({ percent: 9.5 });
  });
  it('notes, print failures and the heartbeat', async () => {
    await store.addNote(env, { kind: 'order', target: 'GP-N1', note: 'Fragile', by_name: 'Sam' });
    expect((await store.listNotes(env, 'order', 'GP-N1'))[0].note).toBe('Fragile');
    const job = await store.queuePrint(env, { shipment_id: 'GP-N1', kind: 'label_pdf', payload: 'http://x/l.pdf' });
    expect((await store.nextPrintJob(env))?.id).toBe(job);
    await store.markPrintFailed(env, job, 'timed out', 5);
    expect((await store.nextPrintJob(env))?.id).not.toBe(job);
    expect((await store.listPrintFailures(env)).some((f) => f.job_id === job)).toBe(true);
    await store.clearPrintFailure(env, job);
    expect((await store.nextPrintJob(env))?.id).toBe(job);
    await store.markPrinted(env, job);
    expect(await store.getHeartbeat(env)).toBeNull();
    await store.setHeartbeat(env, { printer: 'counter', at: new Date().toISOString(), version: 't' });
    expect((await store.getHeartbeat(env))?.version).toBe('t');
  });
});

describe('business accounts and invoices', () => {
  it('an account bills shipments to a statement once', async () => {
    const cid = (await store.upsertCustomer(env, { name: 'Lee', email: 'lee@bayou.example' }))!;
    const acc = await store.addAccount(env, { customer_id: cid, business_name: 'Bayou Candles', discount_percent: 10, notes: '' });
    expect((await store.accountForContact(env, 'LEE@bayou.example', null))?.id).toBe(acc.id);
    const o = order({ total: 8.69, rate: rate(8.69) });
    await store.recordShipment(env, o, label('4'), 'account');
    await store.billShipmentToAccount(env, o.id, acc.id);
    const open = await store.accountOpenShipments(env, acc);
    expect(open.map((l) => l.id)).toEqual([o.id]);
    const st = await store.saveStatement(env, { account_id: acc.id, period: '2026-10', total: 8.69, lines: open, stripe_invoice_id: null, stripe_invoice_url: null });
    expect(await store.accountOpenShipments(env, acc)).toEqual([]);
    expect(await store.markStatementPaid(env, st.id)).toBe(true);
    expect(await store.markStatementPaid(env, st.id)).toBe(false);
    await store.updateAccount(env, acc.id, { active: 0 });
    expect(await store.accountForContact(env, 'lee@bayou.example', null)).toBeNull();
  });
  it('invoice audits save, reopen, and take a dispute', async () => {
    const inv = await store.saveInvoice(env, { carrier: 'UPS', label: 'Test week', uploaded_by: 'Rin', lines: [{ tracking: '1Z1', shipment_id: 'GP-A', carrier: 'UPS', service: 'Ground', billed: 30, expected: 12, variance: 18, status: 'over', description: 'Base + Address Correction', line_date: null }], summary: { lines: 1, billed: 30, expected: 12, overcharged_amount: 18 } });
    const got = await store.getInvoice(env, inv.id);
    expect(got?.summary).toMatchObject({ over: 1, overcharged_amount: 18 });
    expect(await store.disputeLine(env, inv.id, got!.lines[0].id, true, 'Claim 1234')).toBe(true);
    expect((await store.getInvoice(env, inv.id))?.lines[0]).toMatchObject({ disputed: 1, note: 'Claim 1234' });
    expect(await store.disputeLine(env, inv.id, 999999, true, '')).toBe(false);
    expect((await store.listInvoices(env))[0].id).toBe(inv.id);
  });
  it('shipmentsByTracking matches regardless of spaces and case', async () => {
    const o = order();
    await store.recordShipment(env, o, { ...label('5'), tracking_number: '1Z AB cd 1234' }, 'pos');
    const m = await store.shipmentsByTracking(env, ['1zabCD1234']);
    expect(m.get('1ZABCD1234')?.id).toBe(o.id);
  });
});

describe('returns drop-off requests', () => {
  it('creates a coded request, lists it oldest first while open, and serves it with the drop-off', async () => {
    const a = await store.createReturnRequest(env, { customer_name: 'Pat Return', phone: '318', email: null, carrier: 'Amazon', label: 'print', box: 1, tracking: null, notes: null });
    const b = await store.createReturnRequest(env, { customer_name: 'Sam Return', phone: null, email: null, carrier: null, label: 'printed', box: 0, tracking: '1Z999AA10123456784', notes: 'two boxes' });
    expect(a.code).toMatch(/^RT-[A-Z2-9]{6}$/);
    expect((await store.getReturnRequest(env, a.code.toLowerCase()))?.customer_name).toBe('Pat Return');
    const open = await store.listOpenReturns(env);
    expect(open.map((r) => r.code)).toEqual([a.code, b.code]);
    const d = await store.recordDropoff(env, { barcode: '1Z999AA10123456784', customer_name: 'Sam Return' });
    const served = await store.markReturnServed(env, b.code, d.id);
    expect(served).toMatchObject({ status: 'served', dropoff_id: d.id });
    expect((await store.listOpenReturns(env)).map((r) => r.code)).toEqual([a.code]);
    expect(await store.markReturnServed(env, 'RT-NOPE', null)).toBeNull();
  });
});

describe("the buyer's figures (T24)", () => {
  it('weeks, payment mix, account share, mailbox MRR and churn, claims', async () => {
    const cid = (await store.upsertCustomer(env, { name: 'Acq Co', email: 'acq@example.com' }))!;
    const acc = await store.addAccount(env, { customer_id: cid, business_name: 'Acq Co', discount_percent: 0, notes: '' });
    const a = order({ id: 'GP-ACQ1', created_at: '2030-01-07T10:00:00Z', source: 'counter' }); // a Tuesday
    const b = order({ id: 'GP-ACQ2', created_at: '2030-01-15T10:00:00Z' });
    await store.recordShipment(env, { ...a, status: 'labeled', label: label('a1') } as any, label('a1'), 'account');
    await store.recordShipment(env, { ...b, status: 'labeled', label: label('b1') } as any, label('b1'), 'stripe');
    await store.billShipmentToAccount(env, 'GP-ACQ1', acc.id);
    await store.createMailbox(env, { code: 'MB-ACQ1', customer_id: null, customer_name: 'B', email: 'b@example.com', phone: null, business_name: null, size: 'small', term: 'yearly', price: 150 });
    await store.updateMailbox(env, 'MB-ACQ1', { status: 'active', started_at: '2029-12-01T00:00:00Z' });
    await store.createMailbox(env, { code: 'MB-ACQ2', customer_id: null, customer_name: 'C', email: 'c@example.com', phone: null, business_name: null, size: 'large', term: 'monthly', price: 30 });
    await store.updateMailbox(env, 'MB-ACQ2', { status: 'cancelled', started_at: '2029-12-01T00:00:00Z', cancelled_at: '2030-01-10T00:00:00Z' });
    await store.createClaim(env, { code: 'CL-ACQ1', shipment_id: 'GP-ACQ2', kind: 'lost', carrier: 'USPS', tracking_number: null, declared_usd: 50, postage_usd: 9, claimed_usd: 59, insured: 0, customer_name: null, customer_email: null, customer_phone: null, notes: null, by_name: 'T' });
    await store.updateClaim(env, 'CL-ACQ1', { status: 'refunded', customer_refund_usd: 40, refunded_at: '2030-01-20T00:00:00Z' });
    const f = await store.acquirerFigures(env, '2030-01-01', '2030-01-31');
    expect(f.by_week.map((w) => [w.week, w.shipments])).toEqual([['2030-01-07', 1], ['2030-01-14', 1]]);
    expect(f.accounts.by_account[0]).toMatchObject({ business_name: 'Acq Co', shipments: 1 });
    expect(f.accounts.share).toBe(50);
    expect(f.mix.find((m) => m.source === 'account')?.shipments).toBe(1);
    expect(f.mix.find((m) => m.source === 'online')?.shipments).toBe(1);
    expect(f.mailboxes).toMatchObject({ active: 1, cancelled: 1, mrr: 12.5, churn: 50 });
    expect(f.claims).toMatchObject({ refunded: 1, refunded_usd: 40 }); // opened counts by created_at, which is today, outside the 2030 range
  });
});
