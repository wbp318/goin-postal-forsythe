import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { fullness, reminderText, day, addMonths, packageFeesDue, packageState } from '../src/lib/mailbox';
import { upsertCustomer, assignMailbox, addStaff, getMailbox, getMailboxSettings, listMailboxCharges, listAudit, addMailboxItem } from '../src/shipping/store';
import { hashPin } from '../src/lib/auth';
import { signSession } from '../src/lib/session';
import { chargeOverages, autoRenewals, packageJobs } from '../src/lib/mailboxJobs';
import { POST } from '../src/pages/api/mailbox';
import { GET as mockPaid } from '../src/pages/api/mock-paid';

// The mail log, capacity and overage, the card on file, automatic renewal, forwarding (Peter, Nov 16 2026).
const call = async (body: Record<string, unknown>, cookie?: string) => {
  const res = await (POST as any)({ request: new Request('http://x/api/mailbox', { method: 'POST', headers: cookie ? { cookie } : {}, body: JSON.stringify(body) }) });
  return { status: res.status, body: await res.json() };
};
const follow = (url: string) => (mockPaid as any)({ url: new URL(url), redirect: (to: string) => new Response(null, { status: 302, headers: { Location: to } }) });

describe('capacity', () => {
  it('counts pieces against the size', () => {
    expect(fullness(7, 'small')).toEqual({ pieces: 7, capacity: 20, pct: 35, full: false, over: 0 });
    expect(fullness(20, 'small')).toMatchObject({ full: true, over: 0, pct: 100 });
    expect(fullness(23, 'small')).toMatchObject({ over: 3, pct: 115 });
    expect(fullness(50, 'medium').full).toBe(true);
    expect(fullness(114, 'large').full).toBe(false);
  });
  it('the automatic-renewal reminder spells out that it renews unless turned off', () => {
    const w = reminderText({ box_no: 1105, paid_through: '2027-05-15' }, '2027-05-15:30', { name: 'GP', phone: '1' }, 'http://x/account#mailbox', { amount: 90, last4: '4242', term: 6 });
    expect(w.email).toContain('Unless you turn it off');
    expect(w.email).toContain('$90.00 (6 months, the same plan as now)');
    expect(w.email).toContain('If you do NOT want it to renew');
    expect(w.subject).toContain('renews automatically');
  });
});

describe('mail log, card and billing', () => {
  let cust = '';
  let cookie = '';
  let boxId = 0;
  const today = day(new Date());
  beforeAll(async () => {
    Object.assign(env as any, { COUNTER_PIN: '1234', OWNER_PIN: '9999', SITE_URL: 'http://x', STRIPE_SECRET_KEY: '' });
    await addStaff(env as any, { name: 'Clerk Cleo', pin_hash: await hashPin('6666'), role: 'counter' });
    cust = (await upsertCustomer(env as any, { name: 'Molly Mail', email: 'molly@example.com', phone: '318-555-0150' }))!;
    cookie = `gp_customer=${encodeURIComponent(await signSession(env as any, cust))}`;
    boxId = (await assignMailbox(env as any, { box_no: 1199, customer_id: cust, size: 'small', term: 6, start_date: today, paid_through: addMonths(today, 6) })).id;
  });

  it('letters fill the box: one notice a day; the 21st letter in a small box is a 45-cent overage', async () => {
    const first = await call({ pin: '6666', action: 'mail_in', box_no: '1199', kind: 'letter' });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ pieces: 1, capacity: 20, over: false, notified: true, packages: 0 });
    for (let i = 2; i <= 20; i++) expect((await call({ pin: '6666', action: 'mail_in', box_no: 1199, kind: 'letter' })).body.notified).toBe(false);
    const extra = await call({ pin: '6666', action: 'mail_in', box_no: 1199, kind: 'letter', note: 'catalog' });
    expect(extra.body).toMatchObject({ pieces: 21, over: true });
    const fees = await listMailboxCharges(env as any, { customer_id: cust, status: 'unbilled' });
    expect(fees.map((c) => [c.kind, c.amount])).toEqual([['overage', 0.45]]);
    expect((await call({ pin: '6666', action: 'mail_in', box_no: 1500, kind: 'letter' })).status).toBe(404);
  });

  it('packages do not fill the box; a 3rd package gets its own notice the same day', async () => {
    const a = await call({ pin: '6666', action: 'mail_in', box_no: 1199, kind: 'package' });
    expect(a.body).toMatchObject({ pieces: 21, packages: 1, over: false, extra_package: false, notified: false });
    await call({ pin: '6666', action: 'mail_in', box_no: 1199, kind: 'package' });
    const c = await call({ pin: '6666', action: 'mail_in', box_no: 1199, kind: 'package', note: 'Amazon' });
    expect(c.body).toMatchObject({ packages: 3, extra_package: true, notified: true });
    expect((await listMailboxCharges(env as any, { customer_id: cust, status: 'unbilled' })).length).toBe(1); // no fee on the day it comes in
  });

  it('undo takes the piece out and waives its fee', async () => {
    const r = await call({ pin: '6666', action: 'mail_in', box_no: 1199, kind: 'letter' });
    expect(r.body.over).toBe(true);
    expect((await listMailboxCharges(env as any, { customer_id: cust, status: 'unbilled' })).length).toBe(2);
    expect((await call({ pin: '6666', action: 'mail_undo', item_id: r.body.item.id })).status).toBe(200);
    expect((await listMailboxCharges(env as any, { customer_id: cust, status: 'unbilled' })).length).toBe(1);
  });

  it('the staff list shows how full each box is, letters only, with the packages beside it', async () => {
    const list = await call({ pin: '6666', action: 'list' });
    const b = list.body.boxes.find((x: any) => x.box_no === 1199);
    expect(b.inbox).toMatchObject({ letters: 21, packages: 3, pieces: 21, capacity: 20, pct: 105, pkg_late: false, pkg_rts: false });
  });
  it('overages wait for a card, and for 50 cents', async () => {
    expect(await chargeOverages(env as any, cust)).toMatchObject({ status: 'no_card', total: 0.45 });
  });

  it('staff add a card only with the customer\'s agreement; saving it turns automatic renewal on', async () => {
    expect((await call({ pin: '6666', action: 'card_link', customer_id: cust })).status).toBe(400);
    const r = await call({ pin: '6666', action: 'card_link', customer_id: cust, agreed: true });
    expect(r.body.url).toContain('/api/mock-paid?order=MCARD-');
    const res = await follow(r.body.url);
    expect(res.headers.get('Location')).toBe('/counter/mailboxes?card=1');
    const st = await getMailboxSettings(env as any, cust);
    expect(st).toMatchObject({ card_last4: '4242', autorenew: 1, card_added_by: 'Clerk Cleo' });
    expect(await chargeOverages(env as any, cust)).toMatchObject({ status: 'too_small' });
  });

  it('charges overages once they reach 50 cents; only managers can charge by hand', async () => {
    await call({ pin: '6666', action: 'mail_in', box_no: 1199, kind: 'letter' }); // 0.90 now
    expect((await call({ pin: '6666', action: 'charge_now', customer_id: cust })).status).toBe(403);
    const r = await call({ pin: '1234', action: 'charge_now', customer_id: cust });
    expect(r.body).toMatchObject({ status: 'paid', charged: 0.9 });
    expect((await listMailboxCharges(env as any, { customer_id: cust, status: 'unbilled' }))).toEqual([]);
    expect((await call({ pin: '6666', action: 'box_detail', id: boxId })).body.balance.due).toBe(0);
  });

  it('pick up clears the box', async () => {
    const r = await call({ pin: '6666', action: 'pickup', id: boxId });
    expect(r.body.n).toBe(25);
    const b = (await call({ pin: '6666', action: 'list' })).body.boxes.find((x: any) => x.box_no === 1199);
    expect(b.inbox.pieces).toBe(0);
  });

  it('automatic renewal charges the same plan on the paid-through day, once', async () => {
    const due = await assignMailbox(env as any, { box_no: 1198, customer_id: cust, size: 'small', term: 12, start_date: addMonths(today, -12), paid_through: today });
    const r = await autoRenewals(env as any, today);
    expect(r.find((x) => x.box_no === 1198)).toMatchObject({ ok: true, paid_through: addMonths(today, 12) });
    expect((await getMailbox(env as any, due.id))!.paid_through).toBe(addMonths(today, 12));
    expect((await listMailboxCharges(env as any, { customer_id: cust })).find((c) => c.kind === 'renewal')).toMatchObject({ amount: 180, status: 'paid' });
    expect((await autoRenewals(env as any, today)).find((x) => x.box_no === 1198)).toBeUndefined();
    expect((await listAudit(env as any)).some((a) => a.action === 'mailbox.autorenew')).toBe(true);
  });

  it('the holder turns automatic renewal off, sets notices, and asks to forward mail', async () => {
    expect((await call({ action: 'set_prefs', autorenew: false })).status).toBe(401);
    expect((await call({ action: 'set_prefs', autorenew: false, notify_sms: false }, cookie)).body.settings).toEqual({ autorenew: false, notify_sms: false, notify_email: true });
    expect((await call({ action: 'forward_request', id: boxId, address: 'short' }, cookie)).status).toBe(400);
    const f = await call({ action: 'forward_request', id: boxId, address: '123 Main St, Ruston, LA 71270', note: 'until March' }, cookie);
    expect(f.status).toBe(200);
    const open = (await call({ pin: '6666', action: 'list' })).body.forwards;
    expect(open.map((x: any) => [x.box_no, x.address])).toEqual([[1199, '123 Main St, Ruston, LA 71270']]);
    await call({ pin: '6666', action: 'forward_set', id: f.body.forward.id, status: 'done' });
    expect((await call({ pin: '6666', action: 'list' })).body.forwards).toEqual([]);
    await call({ action: 'card_remove' }, cookie);
    expect(await getMailboxSettings(env as any, cust)).toMatchObject({ payment_method_id: null, autorenew: 0 });
    expect((await call({ action: 'set_prefs', autorenew: true }, cookie)).status).toBe(400); // needs a card
  });
});

describe('package rules: 2 free at a time, 5 free days, $1 a day up to $10, final notice on day 30', () => {
  const ago = (today: string, n: number) => new Date(Date.parse(today + 'T15:00:00Z') - n * 86_400_000).toISOString();
  it('works out the fees for a box', () => {
    const t = '2026-11-20';
    const pk = [{ id: 1, arrived_at: ago(t, 8) }, { id: 2, arrived_at: ago(t, 3) }, { id: 3, arrived_at: ago(t, 2) }, { id: 4, arrived_at: ago(t, 1) }];
    const due = packageFeesDue(pk, new Set(), t);
    // #1: here 8 days, 3 storage days. #3 (3rd at a time, 2 days): $2. #4 (4th, only 1 day): nothing yet.
    expect(due.map((d) => [d.marker, d.amount])).toEqual([['1:storage:1', 1], ['1:storage:2', 1], ['1:storage:3', 1], ['3:extra', 2]]);
    expect(packageFeesDue(pk, new Set(due.map((d) => d.marker)), t)).toEqual([]); // never twice
    const long = packageFeesDue([{ id: 9, arrived_at: ago(t, 40) }], new Set(), t);
    expect(long.reduce((a, d) => a + d.amount, 0)).toBe(10); // capped
    expect(packageState({ arrived_at: ago(t, 40) }, 0, t)).toMatchObject({ storage: 10, rts: true, late: true });
    expect(packageState({ arrived_at: ago(t, 30) }, 0, t)).toMatchObject({ rts: false });
    expect(packageState({ arrived_at: ago(t, 33) }, 0, t)).toMatchObject({ rts: true });
    expect(packageState({ arrived_at: ago(t, 3) }, 0, t)).toMatchObject({ storage: 0, extra: 0, late: false });
  });

  it('the daily run adds the fees once and sends one notice per stage', async () => {
    const today = day(new Date());
    const who = (await upsertCustomer(env as any, { name: 'Pat Parcel', email: 'pat@example.com', phone: '318-555-0170' }))!;
    const box = await assignMailbox(env as any, { box_no: 1188, customer_id: who, size: 'small', term: 6, start_date: today, paid_through: addMonths(today, 6) });
    const add = (days: number) => addMailboxItem(env as any, { mailbox_id: box.id, customer_id: who, box_no: 1188, kind: 'package', note: null, over: 0, by_name: 'test' });
    const a = await add(0); a.arrived_at = ago(today, 7); // mem store: backdate in place
    const r1 = await packageJobs(env as any, today);
    expect(r1.notices).toBeGreaterThanOrEqual(1);
    const fees = (await listMailboxCharges(env as any, { customer_id: who })).filter((c) => c.kind === 'storage');
    expect(fees.map((c) => c.amount)).toEqual([1, 1]); // days 6 and 7
    const r2 = await packageJobs(env as any, today);
    expect((await listMailboxCharges(env as any, { customer_id: who })).filter((c) => c.kind === 'storage').length).toBe(2);
    const keys: string[] = JSON.parse((await getMailbox(env as any, box.id))!.reminders);
    expect(keys).toEqual(expect.arrayContaining([`p${a.id}:d4`, `p${a.id}:d6`]));
    expect(r2.notices).toBe(0);
    a.arrived_at = ago(today, 30);
    expect((await packageJobs(env as any, today)).notices).toBe(1); // the final notice
    expect((await listMailboxCharges(env as any, { customer_id: who })).filter((c) => c.kind === 'storage').reduce((s, c) => s + c.amount, 0)).toBe(10);
  });
});
