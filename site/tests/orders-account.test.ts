// A business account's discount online goes to its holder signed in, not to another customer.
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import * as store from '../src/shipping/store';
import { signSession, sessionCookie } from '../src/lib/session';
import { quote } from '../src/lib/quote';
import { getOrder } from '../src/lib/orders';
import { store as facts } from '../src/data/store';
import { parseAddress, parseParcel } from '../src/lib/validate';
import { setOnlineLabels } from '../src/lib/siteSettings';

const E = env as any;
const dest = { contact_name: 'Pat Lee', line_1: '200 Main St', city: 'Monroe', state: 'LA', postal_code: '71201' };
const parcel = { weight_lb: 2, length_in: 10, width_in: 8, height_in: 4, description: 'Shirt', value_usd: 20 };

async function placeOrder(cookie: string, phone: string) {
  const { rates } = await quote(E, facts.origin, parseAddress(dest), parseParcel(parcel));
  const { POST } = await import('../src/pages/api/orders');
  const res = await (POST as any)({ request: new Request('http://x/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ destination: dest, parcel, rate_id: rates[0].id, acct_phone: phone }) }) });
  const j = await res.json();
  expect(j.error).toBeUndefined();
  return getOrder(E, j.order_id);
}
const cookieFor = async (id: string) => sessionCookie(await signSession(E, id), false).split(';')[0];

describe('business discount online', () => {
  it('goes to the account holder signed in, not to another signed-in customer', async () => {
    await setOnlineLabels(E, true, 'test');
    const cid = (await store.upsertCustomer(E, { name: 'Bayou Crafts', email: 'disc-holder@example.com' }))!;
    await store.addAccount(E, { customer_id: cid, business_name: 'Bayou Crafts', discount_percent: 20, notes: '' });
    const other = (await store.upsertCustomer(E, { name: 'Other Person', email: 'disc-other@example.com' }))!;

    const asOther = await placeOrder(await cookieFor(other), '3185550142');
    expect(asOther?.discount_percent).toBeUndefined();
    const asHolder = await placeOrder(await cookieFor(cid), '3185550143');
    expect(asHolder?.discount_percent).toBe(20);
  });
});

describe('customer records from the website', () => {
  it('an online order can not attach its email to a customer known only by phone', async () => {
    const bizId = (await store.upsertCustomer(E, { name: 'Phone Only Biz', phone: '3185550177' }, { trusted: true }))!;
    const other = await store.upsertCustomer(E, { name: 'Someone', email: 'claimer@example.com', phone: '3185550177' });
    expect(other).not.toBe(bizId);
    expect((await store.getCustomer(E, bizId))?.email).toBeFalsy();
    expect((await store.getCustomer(E, other!))?.phone).toBeFalsy();
  });

  it('an online order does not rename a customer, and the counter can still link a phone', async () => {
    const id = (await store.upsertCustomer(E, { name: 'Real Name', email: 'rename@example.com' }, { trusted: true }))!;
    await store.upsertCustomer(E, { name: 'Recipient Person', email: 'rename@example.com', phone: '3185550178' });
    expect((await store.getCustomer(E, id))?.name).toBe('Real Name');
    expect((await store.getCustomer(E, id))?.phone).toBeFalsy();
    await store.upsertCustomer(E, { name: 'Real Name', email: 'rename@example.com', phone: '3185550178' }, { trusted: true });
    expect((await store.getCustomer(E, id))?.phone).toBe('3185550178');
  });

  it('the account page lists orders by the signed-in email, not by a phone on the account', async () => {
    const order: any = { id: 'GP-PHONEONLY1', status: 'paid', source: 'counter', name: 'Phone Person', phone: '3185550179', sms: false,
      rate: { carrier: 'USPS', service: 'Ground Advantage', total_charge: 9.5 }, origin: facts.origin,
      destination: { contact_name: 'Pat', line_1: '1 Main', city: 'Monroe', state: 'LA', postal_code: '71201', country_alpha2: 'US' },
      parcel, international: false, created_at: new Date().toISOString() };
    await store.upsertQuote(E, order);
    const someone: any = { id: 'C-X', name: 'Someone', email: 'not-them@example.com', phone: '3185550179' };
    expect((await store.customerQuotes(E, someone)).some((q) => q.id === 'GP-PHONEONLY1')).toBe(true); // staff view
    expect((await store.customerQuotes(E, someone, { byPhone: false })).some((q) => q.id === 'GP-PHONEONLY1')).toBe(false);
  });
});

describe('emails only arrive with a new record', () => {
  it('a walk-up typed by staff with a business account\'s phone and another email makes a new customer', async () => {
    const victim = (await store.upsertCustomer(E, { name: 'Phone Only Shop', phone: '3185550181' }, { trusted: true }))!;
    await store.addAccount(E, { customer_id: victim, business_name: 'Phone Only Shop', discount_percent: 10, notes: '' });
    const walkup = await store.upsertCustomer(E, { name: 'Walk Up', email: 'walkup@example.com', phone: '3185550181' }, { trusted: true });
    expect(walkup).not.toBe(victim);
    expect((await store.getCustomer(E, victim))?.email).toBeFalsy();
  });

  it('an account page can not take a phone that is on another customer', async () => {
    await store.upsertCustomer(E, { name: 'Has Phone', phone: '3185550182' }, { trusted: true });
    const me = (await store.upsertCustomer(E, { name: 'Me', email: 'phone-taker@example.com' }))!;
    expect((await store.phoneHolder(E, '(318) 555-0182', me))?.name).toBe('Has Phone');
    expect(await store.phoneHolder(E, '3185550183', me)).toBeNull();
  });
});

describe('a business account holder\'s email', () => {
  it('a manager can give a phone-only account an email, which then shows the dashboard', async () => {
    const id = (await store.upsertCustomer(E, { name: 'Mobile Only Co', phone: '3185550191' }, { trusted: true }))!;
    await store.addAccount(E, { customer_id: id, business_name: 'Mobile Only Co', discount_percent: 5, notes: '' });
    expect(await store.accountForContact(E, 'owner@mobileonly.example', null)).toBeNull();
    await store.setCustomerEmail(E, id, ' Owner@MobileOnly.example ');
    expect((await store.accountForContact(E, 'owner@mobileonly.example', null))?.business_name).toBe('Mobile Only Co');
  });
});
