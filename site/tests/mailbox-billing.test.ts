import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { day, addMonths } from '../src/lib/mailbox';
import { upsertCustomer, assignMailbox, addStaff, saveMailboxSettings, addMailboxCharge, getMailbox, listMailboxCharges } from '../src/shipping/store';
import { hashPin } from '../src/lib/auth';
import { POST } from '../src/pages/api/mailbox';

// The Billing card (Peter, Nov 16 2026): a list to look at; charging is one customer at a time, by a manager.
const call = async (body: Record<string, unknown>) => {
  const res = await (POST as any)({ request: new Request('http://x/api/mailbox', { method: 'POST', body: JSON.stringify(body) }) });
  return { status: res.status, body: await res.json() };
};

describe('billing view', () => {
  let a = ''; let b = ''; let boxB = 0;
  const today = day(new Date());
  beforeAll(async () => {
    Object.assign(env as any, { COUNTER_PIN: '1234', OWNER_PIN: '9999', SITE_URL: 'http://x', STRIPE_SECRET_KEY: '' });
    await addStaff(env as any, { name: 'Clerk Bea', pin_hash: await hashPin('7777'), role: 'counter' });
    a = (await upsertCustomer(env as any, { name: 'Ann Owes', email: 'ann@example.com', phone: '318-555-0161' }))!;
    b = (await upsertCustomer(env as any, { name: 'Ben Renews', email: 'ben@example.com', phone: '318-555-0162' }))!;
    const boxA = await assignMailbox(env as any, { box_no: 1166, customer_id: a, size: 'small', term: 6, start_date: today, paid_through: addMonths(today, 6) });
    boxB = (await assignMailbox(env as any, { box_no: 1167, customer_id: b, size: 'medium', term: 6, start_date: addMonths(today, -6), paid_through: today })).id;
    await saveMailboxSettings(env as any, a, { payment_method_id: 'pm_mock', card_brand: 'visa', card_last4: '1111', card_exp: '01/30' });
    await saveMailboxSettings(env as any, b, { payment_method_id: 'pm_mock', card_brand: 'visa', card_last4: '2222', card_exp: '01/30', autorenew: 1 });
    await addMailboxCharge(env as any, { customer_id: a, mailbox_id: boxA.id, kind: 'storage', amount: 1, description: 'Package storage, day 6, box #1166 (fee 1:storage:1)' });
    await addMailboxCharge(env as any, { customer_id: a, mailbox_id: boxA.id, kind: 'overage', amount: 0.45, description: 'Over capacity: letter (piece 5)' });
  });

  it('lists who owes and who renews, and looking charges nobody', async () => {
    const r = await call({ pin: '7777', action: 'billing' });
    expect(r.status).toBe(200);
    expect(r.body.can_charge).toBe(false);
    expect(r.body.due.find((d: any) => d.customer.name === 'Ann Owes')).toMatchObject({ total: 1.45, boxes: [1166], card: { last4: '1111' } });
    expect(r.body.renewals.find((x: any) => x.box_no === 1167)).toMatchObject({ amount: 120, due_now: true, card: { last4: '2222' } });
    expect((await listMailboxCharges(env as any, { customer_id: a, status: 'unbilled' })).length).toBe(2);
    expect((await getMailbox(env as any, boxB))!.paid_through).toBe(today);
  });

  it('only a manager or owner charges, one customer at a time', async () => {
    expect((await call({ pin: '7777', action: 'charge_now', customer_id: a })).status).toBe(403);
    expect((await call({ pin: '7777', action: 'renew_now', id: boxB })).status).toBe(403);
    expect((await call({ pin: '1234', action: 'run_billing' })).status).toBe(404); // no "charge everyone"
    expect((await call({ pin: '1234', action: 'charge_now', customer_id: a })).body).toMatchObject({ status: 'paid', charged: 1.45 });
    const r = await call({ pin: '1234', action: 'renew_now', id: boxB });
    expect(r.body).toMatchObject({ ok: true, paid_through: addMonths(today, 6) });
    expect((await call({ pin: '1234', action: 'renew_now', id: boxB })).status).toBe(400); // not due any more
    const after = await call({ pin: '1234', action: 'billing' });
    expect(after.body.due.find((d: any) => d.customer.name === 'Ann Owes')).toBeUndefined();
    expect(after.body.recent.map((x: any) => [x.customer.name, x.amount, x.status])).toEqual(expect.arrayContaining([['Ann Owes', 1, 'paid'], ['Ben Renews', 120, 'paid']]));
  });
});
