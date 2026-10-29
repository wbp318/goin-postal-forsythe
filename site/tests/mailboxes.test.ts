// Mailbox subscriptions: prices from the table, codes, Stripe status folding, and the store's records.
import { describe, it, expect } from 'vitest';
import { priceMailbox, newMailboxCode, statusFromStripe, SIZES, YEAR_MONTHS } from '../src/lib/mailboxes';
import * as store from '../src/shipping/store';

const env = {} as any;

describe('mailbox prices', () => {
  it('monthly is the size price, yearly is YEAR_MONTHS months of it', () => {
    expect(YEAR_MONTHS).toBe(10);
    expect(priceMailbox('small', 'monthly')).toMatchObject({ term: 'monthly', price: 15 });
    expect(priceMailbox('small', 'yearly').price).toBe(150);
    expect(priceMailbox('large', 'anything').term).toBe('monthly');
    expect(() => priceMailbox('huge', 'monthly')).toThrow('Pick a box size');
    expect(SIZES.map((s) => s.id)).toEqual(['small', 'medium', 'large']);
  });
  it('codes and Stripe statuses', () => {
    expect(newMailboxCode()).toMatch(/^MB-[A-Z2-9]{6}$/);
    expect(statusFromStripe('active')).toBe('active');
    expect(statusFromStripe('trialing')).toBe('active');
    expect(statusFromStripe('past_due')).toBe('past_due');
    expect(statusFromStripe('canceled')).toBe('cancelled');
  });
});

describe('mailbox records', () => {
  it('creates awaiting payment, updates fields, finds by subscription, lists newest first', async () => {
    const a = await store.createMailbox(env, { code: 'MB-TEST01', customer_id: null, customer_name: 'Box Holder', email: 'box@example.com', phone: null, business_name: null, size: 'small', term: 'monthly', price: 15 });
    expect(a.status).toBe('awaiting_payment');
    const active = await store.updateMailbox(env, 'mb-test01', { status: 'active', stripe_subscription_id: 'sub_1', started_at: '2026-10-29T00:00:00Z' });
    expect(active?.status).toBe('active');
    expect((await store.getMailboxBySubscription(env, 'sub_1'))?.code).toBe('MB-TEST01');
    expect((await store.getMailbox(env, 'MB-TEST01'))?.stripe_subscription_id).toBe('sub_1');
    const b = await store.createMailbox(env, { code: 'MB-TEST02', customer_id: null, customer_name: 'Second', email: 's@example.com', phone: null, business_name: 'Co', size: 'large', term: 'yearly', price: 300 });
    const list = await store.listMailboxes(env);
    expect(list.map((m) => m.code).slice(0, 2)).toEqual([b.code, a.code]);
    expect(await store.updateMailbox(env, 'MB-NOPE', { notes: 'x' })).toBeNull();
    // unknown keys are ignored, not written
    const same = await store.updateMailbox(env, a.code, { ...( { bogus: 1 } as any) });
    expect(same?.code).toBe(a.code);
  });
});
