import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { sizeForBox, priceFor, addressFor, addMonths, boxStatus, dueReminder, day, reminderText, mailAction, endedOn, onExpiredList } from '../src/lib/mailbox';
import { holdEndNotices, payRenewal } from '../src/lib/mailboxJobs';
import { upsertCustomer, assignMailbox, mailboxesFor, listAudit, exportTable } from '../src/shipping/store';
import { signSession } from '../src/lib/session';
import { POST } from '../src/pages/api/mailbox';
import { GET as mockPaid } from '../src/pages/api/mock-paid';
import { getRenewal } from '../src/shipping/store';

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

  it('sends each reminder once: 2 months, 1 month, 1 week, and after it lapses', () => {
    const b = { status: 'active', paid_through: '2026-12-31', reminders: [] as string[] };
    expect(dueReminder(b, '2026-10-15')).toBeNull(); // 77 days out
    expect(dueReminder(b, '2026-11-15')).toBe('2026-12-31:60'); // 46 days out: the last two months
    b.reminders.push('2026-12-31:60');
    expect(dueReminder(b, '2026-11-20')).toBeNull();
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
    Object.assign(env as any, { COUNTER_PIN: '1234', SITE_URL: 'http://x', SESSION_SECRET: (env as any).SESSION_SECRET || 'test-secret' });
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

  it('the Edit pop-up adds time, takes it back off, and sets a date', async () => {
    const [box] = await mailboxesFor(env as any, customerId);
    expect((await call({ action: 'adjust', pin: '1234', id: box.id, months: 12 })).body.paid_through).toBe('2029-05-15');
    expect((await call({ action: 'adjust', pin: '1234', id: box.id, months: -12 })).body.paid_through).toBe('2028-05-15');
    expect((await call({ action: 'adjust', pin: '1234', id: box.id, months: -6 })).body.paid_through).toBe('2027-11-15');
    expect((await call({ action: 'adjust', pin: '1234', id: box.id, months: 3 })).status).toBe(400);
    const tooFar = await call({ action: 'adjust', pin: '1234', id: box.id, months: -12 });
    expect(tooFar.status).toBe(400); // would end before the box started on 2026-11-15
    expect(tooFar.body.error).toMatch(/before the box started/);
    expect((await call({ action: 'set_paid_through', pin: '1234', id: box.id, date: '2027-12-01' })).body.paid_through).toBe('2027-12-01');
    expect((await call({ action: 'set_paid_through', pin: '1234', id: box.id, date: '2026-01-01' })).status).toBe(400);
    expect((await call({ action: 'set_paid_through', pin: '1234', id: box.id, date: 'soon' })).status).toBe(400);
    const log = (await listAudit(env as any)).filter((a) => a.target === '#1230').map((a) => a.action);
    expect(log).toEqual(expect.arrayContaining(['mailbox.undo', 'mailbox.set_date', 'mailbox.renew']));
  });

  it('a holder renews online: paid once, the box extended once', async () => {
    const [box] = await mailboxesFor(env as any, customerId); // paid through 2027-12-01
    expect((await call({ action: 'renew_checkout', id: box.id, term: 6 })).status).toBe(401);
    const stranger = await upsertCustomer(env as any, { name: 'Someone Else', email: 'else@example.com', phone: '318-555-0111' });
    const otherCookie = `gp_customer=${encodeURIComponent(await signSession(env as any, stranger!))}`;
    expect((await call({ action: 'renew_checkout', id: box.id, term: 6 }, otherCookie)).status).toBe(404);
    const r = await call({ action: 'renew_checkout', id: box.id, term: 6 }, cookie);
    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/\/api\/mock-paid\?order=MRN-/); // demo mode: no Stripe keys
    expect((await getRenewal(env as any, r.body.code))).toMatchObject({ status: 'pending', amount: 120, term: 6 });
    const pay = () => (mockPaid as any)({ url: new URL(r.body.url), redirect: (to: string) => new Response(null, { status: 302, headers: { Location: to } }) });
    const res = await pay();
    expect(res.headers.get('Location')).toBe(`/account?renewed=${r.body.code}#mailbox`);
    expect((await mailboxesFor(env as any, customerId))[0].paid_through).toBe('2028-06-01');
    await pay(); // Stripe can send the same payment twice: still one extension
    expect((await mailboxesFor(env as any, customerId))[0].paid_through).toBe('2028-06-01');
    expect(await getRenewal(env as any, r.body.code)).toMatchObject({ status: 'paid', paid_through: '2028-06-01' });
    expect((await listAudit(env as any)).some((a) => a.action === 'mailbox.renew_online')).toBe(true);
  });

  it('an online renewal counts only when Stripe took the renewal price', async () => {
    const [box] = await mailboxesFor(env as any, customerId); // paid through 2028-06-01
    const r = await call({ action: 'renew_checkout', id: box.id, term: 6 }, cookie);
    expect(await payRenewal(env as any, r.body.code, 'cs_test_1', 100)).toBeNull();
    expect((await mailboxesFor(env as any, customerId))[0].paid_through).toBe('2028-06-01');
    expect(await getRenewal(env as any, r.body.code)).toMatchObject({ status: 'pending' });
    expect(await payRenewal(env as any, r.body.code, 'cs_test_2', 12000)).toBe('2028-12-01');
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

describe('expired boxes: hold the mail 6 months, then return to sender', () => {
  const t = '2026-11-17';
  it('says what to do with the mail', () => {
    expect(mailAction({ status: 'active', paid_through: '2027-01-01', closed_at: null }, t)).toEqual({ do: 'box' });
    expect(mailAction({ status: 'active', paid_through: '2026-11-01', closed_at: null }, t)).toEqual({ do: 'hold', ended: '2026-11-01', until: '2027-05-01' });
    expect(mailAction({ status: 'active', paid_through: '2026-05-01', closed_at: null }, t)).toEqual({ do: 'rts', ended: '2026-05-01', since: '2026-11-02' });
    expect(mailAction({ status: 'active', paid_through: '2026-05-17', closed_at: null }, t)).toMatchObject({ do: 'hold', until: '2026-11-17' }); // last day of the hold
  });
  it('a closed box ends the day it closed (or its paid-through date, if earlier)', () => {
    expect(endedOn({ status: 'closed', paid_through: '2027-03-01', closed_at: '2026-10-05T15:00:00Z' }, t)).toBe('2026-10-05');
    expect(endedOn({ status: 'closed', paid_through: '2026-09-01', closed_at: '2026-10-05T15:00:00Z' }, t)).toBe('2026-09-01');
    expect(mailAction({ status: 'closed', paid_through: '2027-03-01', closed_at: '2026-10-05T15:00:00Z' }, t)).toMatchObject({ do: 'hold', until: '2027-04-05' });
  });
  it('stays on the Expired list for a year', () => {
    expect(onExpiredList({ status: 'active', paid_through: '2026-01-01', closed_at: null }, t)).toBe(true);
    expect(onExpiredList({ status: 'active', paid_through: '2025-11-01', closed_at: null }, t)).toBe(false);
    expect(onExpiredList({ status: 'active', paid_through: '2027-01-01', closed_at: null }, t)).toBe(false); // still paid
  });
  it('the expired text tells the holder how long mail is held', () => {
    expect(reminderText({ box_no: 1105, paid_through: '2026-11-01' }, '2026-11-01:over', { name: 'GP', phone: '1' }).sms).toContain('hold your mail until May 1, 2027');
  });

  it('staff see expired boxes, search past and present holders, and get one "stop holding" email', async () => {
    Object.assign(env as any, { COUNTER_PIN: '1234', SITE_URL: 'http://x', STAFF_EMAIL: 'staff@example.com' });
    const today = day(new Date());
    const ago = (m: number) => addMonths(today, -m);
    const who = (await upsertCustomer(env as any, { name: 'Lapsed Larry', email: 'larry@example.com', phone: '318-555-0123' }))!;
    await assignMailbox(env as any, { box_no: 1310, customer_id: who, size: 'large', term: 6, start_date: ago(8), paid_through: ago(2) }); // holding
    await assignMailbox(env as any, { box_no: 1311, customer_id: who, size: 'large', term: 6, start_date: ago(14), paid_through: ago(8) }); // hold over
    await assignMailbox(env as any, { box_no: 1312, customer_id: who, size: 'large', term: 6, start_date: ago(20), paid_through: ago(14) }); // off the list
    const list = (await call({ action: 'list', pin: '1234' })).body;
    expect(list.boxes.map((x: any) => x.box_no)).not.toContain(1310);
    const ended = list.ended.filter((x: any) => x.customer.name === 'Lapsed Larry');
    expect(ended.map((x: any) => [x.box_no, x.mail.do])).toEqual([[1311, 'rts'], [1310, 'hold']]);
    const byNo = (await call({ action: 'search', pin: '1234', q: '#1312' })).body.boxes;
    expect(byNo.map((x: any) => [x.box_no, x.mail.do])).toEqual([[1312, 'rts']]);
    const byName = (await call({ action: 'search', pin: '1234', q: 'larry' })).body.boxes;
    expect(byName.map((x: any) => x.box_no).sort()).toEqual([1310, 1311, 1312]);
    expect((await call({ action: 'search', pin: '1234', q: '' })).body.boxes).toEqual([]);
    expect(await holdEndNotices(env as any)).toEqual([1311]);
    expect(await holdEndNotices(env as any)).toEqual([]); // once only
    expect((await listAudit(env as any)).some((a) => a.action === 'mailbox.hold_end' && a.detail === '#1311')).toBe(true);
  });
});
