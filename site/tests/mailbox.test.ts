import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { sizeForBox, priceFor, addressFor, addMonths, boxStatus, dueReminder, day, reminderText } from '../src/lib/mailbox';
import { upsertCustomer, assignMailbox, mailboxesFor, listAudit, exportTable } from '../src/shipping/store';
import { signSession } from '../src/lib/session';
import { POST } from '../src/pages/api/mailbox';

// Mailboxes on the website (Peter, Nov 15 2026): sizes and numbers, paid-through dates, reminders, and the API.
const call = async (body: Record<string, unknown>, cookie?: string) => {
  const headers: Record<string, string> = cookie ? { cookie } : {};
  const res = await (POST as any)({ request: new Request('http://x/api/mailbox', { method: 'POST', headers, body: JSON.stringify(body) }) });
  return { status: res.status, body: await res.json() };
};

describe('mailbox sizes, prices and dates', () => {
  it('knows which size each box number is', () => {
    expect(sizeForBox(1100)?.id).toBe('small');
    expect(sizeForBox(1220)?.id).toBe('small');
    expect(sizeForBox(1221)?.id).toBe('medium');
    expect(sizeForBox(1284)?.id).toBe('medium');
    expect(sizeForBox(1290)).toBeNull();
    expect(sizeForBox(1300)?.id).toBe('large');
    expect(sizeForBox(1323)?.id).toBe('large');
    expect(sizeForBox(1324)).toBeNull();
    expect(sizeForBox(1100.5)).toBeNull();
  });

  it('has Peter\'s prices and the address format', () => {
    expect([priceFor('small', 6), priceFor('small', 12)]).toEqual([90, 180]);
    expect([priceFor('medium', 6), priceFor('medium', 12)]).toEqual([120, 240]);
    expect([priceFor('large', 6), priceFor('large', 12)]).toEqual([180, 360]);
    expect(addressFor(1105)).toBe('1800 Forsythe Ave, Suite 2 #1105, Monroe, LA 71201');
  });

  it('adds months, keeping month ends sensible', () => {
    expect(addMonths('2026-11-15', 6)).toBe('2027-05-15');
    expect(addMonths('2026-11-15', 12)).toBe('2027-11-15');
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
  });

  it('tells current, due soon, overdue and closed apart', () => {
    expect(boxStatus({ status: 'active', paid_through: '2027-05-15' }, '2026-11-15')).toBe('current');
    expect(boxStatus({ status: 'active', paid_through: '2026-12-10' }, '2026-11-15')).toBe('due_soon');
    expect(boxStatus({ status: 'active', paid_through: '2026-11-14' }, '2026-11-15')).toBe('overdue');
    expect(boxStatus({ status: 'closed', paid_through: '2026-11-14' }, '2026-11-15')).toBe('closed');
  });

  it('sends each reminder once: 30 days, 7 days, and after it lapses', () => {
    const b = { status: 'active', paid_through: '2026-12-31', reminders: [] as string[] };
    expect(dueReminder(b, '2026-11-15')).toBeNull(); // 46 days out
    expect(dueReminder(b, '2026-12-01')).toBe('2026-12-31:30');
    b.reminders.push('2026-12-31:30');
    expect(dueReminder(b, '2026-12-10')).toBeNull();
    expect(dueReminder(b, '2026-12-24')).toBe('2026-12-31:7');
    b.reminders.push('2026-12-31:7');
    expect(dueReminder(b, '2026-12-31')).toBeNull();
    expect(dueReminder(b, '2027-01-01')).toBe('2026-12-31:over');
    b.reminders.push('2026-12-31:over');
    expect(dueReminder(b, '2027-01-05')).toBeNull();
    expect(dueReminder({ ...b, reminders: [] }, '2027-03-01')).toBeNull(); // long lapsed: the counter calls
    expect(dueReminder({ ...b, status: 'closed', reminders: [] }, '2026-12-24')).toBeNull();
  });

  it('a missed 30-day reminder doesn\'t pile up with the 7-day one', () => {
    expect(dueReminder({ status: 'active', paid_through: '2026-12-31', reminders: [] }, '2026-12-26')).toBe('2026-12-31:7');
  });

  it('writes plain reminder words', () => {
    const w = reminderText({ box_no: 1105, paid_through: '2026-12-31' }, '2026-12-31:7', { name: "Goin' Postal", phone: '318-555-0100' });
    expect(w.sms).toContain('#1105');
    expect(w.sms).toContain('December 31, 2026');
    expect(reminderText({ box_no: 1105, paid_through: '2026-12-31' }, '2026-12-31:over', { name: 'GP', phone: '1' }).subject).toContain('expired');
  });
});

describe('mailbox API', () => {
  let cookie = '';
  let customerId = '';
  beforeAll(async () => {
    Object.assign(env as any, { COUNTER_PIN: '1234', SESSION_SECRET: (env as any).SESSION_SECRET || 'test-secret' });
    customerId = (await upsertCustomer(env as any, { name: 'Mailbox Tester', email: 'mb@example.com', phone: '318-555-0199' }))!;
    cookie = `gp_customer=${encodeURIComponent(await signSession(env as any, customerId))}`;
  });

  it('reserving needs a signed-in customer', async () => {
    expect((await call({ action: 'reserve', size: 'small', term: 6 })).status).toBe(401);
  });

  it('a customer reserves, and staff see it waiting', async () => {
    const r = await call({ action: 'reserve', size: 'medium', term: 12 }, cookie);
    expect(r.status).toBe(200);
    expect(r.body.reservation).toMatchObject({ size: 'medium', term: 12, price: 240 });
    expect(r.body.reservation.code).toMatch(/^MR-/);
    expect((await call({ action: 'reserve', size: 'huge', term: 6 }, cookie)).status).toBe(400);
    const list = await call({ action: 'list', pin: '1234' });
    expect(list.body.reservations.map((x: any) => x.code)).toEqual([r.body.reservation.code]);
  });

  it('staff assign a box in range, never one in use', async () => {
    expect((await call({ action: 'list', pin: '0000' })).status).toBe(401);
    const list = await call({ action: 'list', pin: '1234' });
    const code = list.body.reservations[0].code;
    expect((await call({ action: 'assign', pin: '1234', customer_id: customerId, box_no: 1290, term: 12 })).status).toBe(400);
    const ok = await call({ action: 'assign', pin: '1234', customer_id: customerId, box_no: 1230, term: 12, start_date: '2026-11-15', reservation_code: code });
    expect(ok.status).toBe(200);
    expect(ok.body.box).toMatchObject({ box_no: 1230, size: 'medium', paid_through: '2027-11-15' });
    expect((await call({ action: 'assign', pin: '1234', customer_id: customerId, box_no: 1230, term: 6 })).status).toBe(409);
    await expect(assignMailbox(env as any, { box_no: 1230, customer_id: customerId, size: 'medium', term: 6, start_date: '2026-11-15', paid_through: '2027-05-15' })).rejects.toThrow(/already in use/);
    const after = await call({ action: 'list', pin: '1234' });
    expect(after.body.reservations).toEqual([]);
    expect(after.body.sizes.find((s: any) => s.id === 'medium').free).toBe(63);
    expect((await mailboxesFor(env as any, customerId)).map((b) => b.box_no)).toEqual([1230]);
  });

  it('renew adds to the paid-through date', async () => {
    const [box] = await mailboxesFor(env as any, customerId);
    const r = await call({ action: 'renew', pin: '1234', id: box.id, term: 6 });
    expect(r.body.paid_through).toBe('2028-05-15');
  });

  it('send due reminders sends each one once', async () => {
    const today = day(new Date());
    const in5 = day(new Date(Date.parse(today + 'T00:00:00Z') + 5 * 86_400_000));
    const box = await assignMailbox(env as any, { box_no: 1105, customer_id: customerId, size: 'small', term: 6, start_date: today, paid_through: in5 });
    const first = await call({ action: 'send_due', pin: '1234' });
    expect(first.status).toBe(200);
    expect(first.body.sent).toEqual([{ box_no: 1105, name: 'Mailbox Tester', key: `${in5}:7`, sms: true, email: true }]);
    const second = await call({ action: 'send_due', pin: '1234' });
    expect(second.body.sent).toEqual([]);
    expect((await listAudit(env as any)).some((a) => a.action === 'mailbox.send_due')).toBe(true);
    const closed = await call({ action: 'close', pin: '1234', id: box.id });
    expect(closed.status).toBe(200);
    expect((await mailboxesFor(env as any, customerId)).map((b) => b.box_no)).toEqual([1230]);
  });

  it('both tables are in the export', async () => {
    expect((await exportTable(env as any, 'mailboxes')).length).toBeGreaterThan(0);
    expect((await exportTable(env as any, 'mailbox_reservations')).length).toBeGreaterThan(0);
  });
});
