import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { day, addMonths } from '../src/lib/mailbox';
import { buildMailboxReport, mailboxReportCsv } from '../src/lib/mailboxReport';
import { upsertCustomer, assignMailbox, addMailboxCharge, listMailboxCharges } from '../src/shipping/store';
import { POST } from '../src/pages/api/mailbox';

// The mailbox report and fixing a piece logged in the wrong box (Peter, Nov 16 2026).
const call = async (body: Record<string, unknown>) => {
  const res = await (POST as any)({ request: new Request('http://x/api/mailbox', { method: 'POST', body: JSON.stringify(body) }) });
  return { status: res.status, text: () => res.text(), json: () => res.json() };
};

describe('mailbox report (the sums)', () => {
  const box = (id: number, size: string, start: string, paid: string, closed: string | null = null) => ({ id, box_no: 1100 + id, customer_id: `C${id}`, size, term: 6, start_date: start, paid_through: paid, status: closed ? 'closed' : 'active', reminders: '[]', created_at: '', updated_at: '', closed_at: closed }) as any;
  const data = {
    boxes: [box(1, 'small', '2026-01-10', '2026-12-01'), box(2, 'small', '2026-10-05', '2027-04-05'), box(3, 'medium', '2026-02-01', '2026-10-20'), box(4, 'large', '2026-03-01', '2026-12-01', '2026-10-15T12:00:00Z')],
    items: [
      { id: 1, kind: 'letter', status: 'in', arrived_at: '2026-10-02T15:00:00Z', out_at: null },
      { id: 2, kind: 'package', status: 'picked_up', arrived_at: '2026-10-03T15:00:00Z', out_at: '2026-10-07T15:00:00Z' },
      { id: 3, kind: 'package', status: 'picked_up', arrived_at: '2026-10-10T15:00:00Z', out_at: '2026-10-12T15:00:00Z' },
      { id: 4, kind: 'letter', status: 'returned', arrived_at: '2026-09-01T15:00:00Z', out_at: '2026-10-20T15:00:00Z' },
    ] as any,
    charges: [
      { id: 1, customer_id: 'C1', mailbox_id: 1, kind: 'overage', amount: 0.45, description: 'Over capacity (piece 9)', status: 'paid', paid_at: '2026-10-08T15:00:00Z', created_at: '2026-10-07T15:00:00Z' },
      { id: 2, customer_id: 'C1', mailbox_id: 1, kind: 'storage', amount: 1, description: 'Package storage, day 6 (fee 2:storage:1)', status: 'paid_counter', paid_at: '2026-10-09T15:00:00Z', created_at: '2026-10-08T15:00:00Z' },
      { id: 3, customer_id: 'C2', mailbox_id: 2, kind: 'renewal', amount: 90, description: 'Automatic renewal', status: 'paid', paid_at: '2026-10-05T15:00:00Z', created_at: '2026-10-05T15:00:00Z' },
      { id: 4, customer_id: 'C2', mailbox_id: 2, kind: 'package', amount: 2, description: 'Package 3', status: 'unbilled', paid_at: null, created_at: '2026-10-28T15:00:00Z' },
      { id: 5, customer_id: 'C2', mailbox_id: 2, kind: 'overage', amount: 0.45, description: 'Over', status: 'waived', paid_at: '2026-10-11T15:00:00Z', created_at: '2026-10-10T15:00:00Z' },
    ] as any,
    renewals: [{ id: 1, code: 'MRN-A', mailbox_id: 1, customer_id: 'C1', term: 6, amount: 90, status: 'paid', paid_at: '2026-10-15T15:00:00Z', created_at: '' }] as any,
    forwards: [{ id: 1, created_at: '2026-10-20T00:00:00Z' }] as any,
    reservations: [{ id: 1, created_at: '2026-10-01T00:00:00Z' }, { id: 2, created_at: '2026-09-01T00:00:00Z' }] as any,
    names: new Map([['C1', 'Ann'], ['C2', 'Bo']]),
  };
  const r = buildMailboxReport(data, '2026-10-01', '2026-10-31', '2026-11-16');

  it('counts boxes', () => {
    expect(r.boxes).toMatchObject({ at_start: 3, at_end: 3, new: 1, closed: 1, expired: 1 });
    expect(r.boxes.by_size.map((s) => [s.size, s.rented])).toEqual([['small', 2], ['medium', 1], ['large', 0]]);
  });
  it('adds up the money', () => {
    expect(r.money).toMatchObject({ online_renewals: { n: 1, amount: 90 }, auto_renewals: { n: 1, amount: 90 }, letter_overage: { n: 1, amount: 0.45 }, fees_paid_at_counter: 1, waived: 0.45, owed_now: 2, total: 181.45 });
  });
  it('counts mail', () => {
    expect(r.mail).toEqual({ letters_in: 1, packages_in: 2, picked_up: 2, forwarded: 0, returned: 1, avg_package_wait_days: 3 });
    expect(r.people).toMatchObject({ reservations: 1, forward_requests: 1 });
  });
  it('makes a spreadsheet with every money line', () => {
    const csv = mailboxReportCsv(r);
    expect(csv).toContain('Total taken,,181.45');
    expect(csv).toContain('2026-10-15,Ann,1101,"Online renewal, 6 months",90.00,paid');
    expect(csv).not.toContain('(piece 9)');
  });
});

describe('mailbox report (the API) and moving a piece', () => {
  let a = ''; let b = '';
  beforeAll(async () => {
    Object.assign(env as any, { COUNTER_PIN: '1234', SITE_URL: 'http://x' });
    const today = day(new Date());
    a = (await upsertCustomer(env as any, { name: 'Wrong Box', email: 'wrong@example.com', phone: '318-555-0171' }))!;
    b = (await upsertCustomer(env as any, { name: 'Right Box', email: 'right@example.com', phone: '318-555-0172' }))!;
    await assignMailbox(env as any, { box_no: 1155, customer_id: a, size: 'small', term: 6, start_date: today, paid_through: addMonths(today, 6) });
    await assignMailbox(env as any, { box_no: 1156, customer_id: b, size: 'small', term: 6, start_date: today, paid_through: addMonths(today, 6) });
  });

  it('moves a piece to the right box and waives any fee it caused', async () => {
    const r = await (await call({ pin: '1234', action: 'mail_in', box_no: 1155, kind: 'package' })).json();
    const box = (await (await call({ pin: '1234', action: 'list' })).json()).boxes.find((x: any) => x.box_no === 1155);
    await addMailboxCharge(env as any, { customer_id: a, mailbox_id: box.id, kind: 'storage', amount: 1, description: `Package storage, day 6 (fee ${r.item.id}:storage:1)` });
    expect((await call({ pin: '1234', action: 'item_move', item_id: r.item.id, box_no: 1999 })).status).toBe(404);
    const m = await (await call({ pin: '1234', action: 'item_move', item_id: r.item.id, box_no: '#1156' })).json();
    expect(m).toMatchObject({ ok: true, box_no: 1156, customer: { name: 'Right Box' } });
    const list = (await (await call({ pin: '1234', action: 'list' })).json()).boxes;
    expect(list.find((x: any) => x.box_no === 1155).inbox.packages).toBe(0);
    expect(list.find((x: any) => x.box_no === 1156).inbox.packages).toBe(1);
    expect((await listMailboxCharges(env as any, { customer_id: a })).map((c) => c.status)).toEqual(['waived']);
  });

  it('runs for any dates, and downloads as a spreadsheet', async () => {
    const today = day(new Date());
    expect((await call({ pin: '1234', action: 'report', from: today, to: '2020-01-01' })).status).toBe(400);
    const j = await (await call({ pin: '1234', action: 'report', from: addMonths(today, -1), to: today })).json();
    expect(j.report.mail.packages_in).toBeGreaterThanOrEqual(1);
    const csv = await (await call({ pin: '1234', action: 'report', from: addMonths(today, -1), to: today, format: 'csv' })).text();
    expect(csv.split('\n')[0]).toContain('mailbox report');
    expect((await call({ pin: '0000', action: 'report', from: today, to: today })).status).toBe(401);
  });
});
