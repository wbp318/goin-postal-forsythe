import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { consumeLoginTokenFull } from '../src/lib/session';
import { indexCardOrder, listCardOrdersFor, saveCardOrder, type CardOrder } from '../src/lib/cardOrders';
import { makeTemplate, PALETTES, SAMPLE } from '../src/lib/cards';

// Account page (Peter, Nov 15 2026): a mobile number at sign-up, and card orders under My orders.
const E = env as any;
const signup = async (body: Record<string, unknown>) => {
  const { POST } = await import('../src/pages/api/account');
  const res = await (POST as any)({ request: new Request('http://x/api/account', { method: 'POST', body: JSON.stringify({ action: 'signup', ...body }), headers: { 'cf-connecting-ip': `t-${Math.random()}` } }) });
  return { status: res.status, body: await res.json() };
};

describe('sign-up asks for a mobile number', () => {
  it('refuses a sign-up without one', async () => {
    const r = await signup({ name: 'Pat', email: 'pat-nophone@example.com', password: 'blue truck on forsythe' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('phone');
  });

  it('carries the number in the confirm link, cleaned to 10 digits', async () => {
    const r = await signup({ name: 'Pat', email: 'pat-phone@example.com', phone: '+1 (318) 555-0100', password: 'blue truck on forsythe' });
    expect(r.status).toBe(200);
    const token = String(r.body.mock_link).match(/token=([0-9a-f]+)/)![1];
    const t = await consumeLoginTokenFull(E, token);
    expect(t?.phone).toBe('3185550100');
  });
});

describe('deals and news at sign-up', () => {
  it('the choices ride in the confirm link until the email is proven', async () => {
    const r = await signup({ name: 'Pat', email: 'pat-mkt@example.com', phone: '3185550100', password: 'blue truck on forsythe', mkt_email: true, mkt_sms: false, lang: 'es' });
    const token = String(r.body.mock_link).match(/token=([0-9a-f]+)/)![1];
    expect((await consumeLoginTokenFull(E, token))?.mkt).toEqual({ email: true, sms: false, lang: 'es' });
  });
  it('only a real true counts as a yes', async () => {
    const r = await signup({ name: 'Pat', email: 'pat-mkt2@example.com', phone: '3185550100', password: 'blue truck on forsythe', mkt_email: 'on', mkt_sms: 1 });
    const token = String(r.body.mock_link).match(/token=([0-9a-f]+)/)![1];
    expect((await consumeLoginTokenFull(E, token))?.mkt).toMatchObject({ email: false, sms: false });
  });
});

describe('My orders: business card orders', () => {
  const order = (id: string, customer_id: string): CardOrder => ({
    id, created_at: new Date().toISOString(), status: 'paid', customer: { name: 'Pat', email: 'p@example.com', phone: '3185550100' }, customer_id,
    quantity: 100, price: 24.99, design: makeTemplate('classic', PALETTES[0], SAMPLE, false), notes: '',
  });

  it('lists only this customer\'s orders, newest first', async () => {
    await saveCardOrder(E, order('CD-AAAAA1', 'cust-1')); await indexCardOrder(E, 'cust-1', 'CD-AAAAA1');
    await saveCardOrder(E, order('CD-AAAAA2', 'cust-1')); await indexCardOrder(E, 'cust-1', 'CD-AAAAA2');
    await saveCardOrder(E, order('CD-BBBBB1', 'cust-2')); await indexCardOrder(E, 'cust-2', 'CD-BBBBB1');
    // Even an index entry pointing at someone else's order is not shown.
    await indexCardOrder(E, 'cust-1', 'CD-BBBBB1');
    expect((await listCardOrdersFor(E, 'cust-1')).map((o) => o.id)).toEqual(['CD-AAAAA2', 'CD-AAAAA1']);
    expect((await listCardOrdersFor(E, 'cust-3'))).toEqual([]);
  });
});
