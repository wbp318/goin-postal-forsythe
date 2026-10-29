// x402 gate: modes, the 402 shape, mock settlement, receipts, the payments table.
import { describe, it, expect } from 'vitest';
import { x402Mode, requirements, paymentRequired, verifyAndSettle, charge, toAtomic, settlementHeaders, X402_PRICES } from '../src/lib/x402';
import { x402Summary, findX402PaymentByTx, markX402Refund, markX402Refunded } from '../src/shipping/store';

const off = {} as any;
const mock = { X402_MOCK: '1' } as any;
const live = { X402_PAY_TO: '0xabc', X402_NETWORK: 'base' } as any;
const req = (h?: Record<string, string>) => new Request('https://x/api/x402/rates', { method: 'POST', headers: h });

describe('x402', () => {
  it('mode is off, mock or live from the secrets, and never free by accident', async () => {
    expect(x402Mode(off)).toBe('off');
    expect(x402Mode(mock)).toBe('mock');
    expect(x402Mode(live)).toBe('live');
    expect(x402Mode({ X402_MOCK: '1', X402_PAY_TO: '0x1' } as any)).toBe('live');
    const c = await charge(off, req({ 'X-PAYMENT': 'mock' }), 'rates', 0.01, 'x');
    expect('response' in c && c.response.status).toBe(503);
  });
  it('a 402 carries the price in USDC atomic units, the receiving address and the header copy', async () => {
    const r = requirements(live, '/api/x402/rates', X402_PRICES.rates, 'rates');
    expect(r.maxAmountRequired).toBe('10000');
    expect(toAtomic(12.34)).toBe('12340000');
    expect(r.payTo).toBe('0xabc');
    expect(r.asset).toMatch(/^0x/);
    const res = paymentRequired(r, 'Payment required');
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.x402Version).toBe(1);
    expect(body.accepts[0].maxAmountRequired).toBe('10000');
    expect(res.headers.get('PAYMENT-REQUIRED')).toBeTruthy();
    const c = await charge(live, req(), 'rates', 0.01, 'x');
    expect('response' in c && c.response.status).toBe(402);
  });
  it('mock mode accepts X-PAYMENT: mock, records the payment and answers with receipt headers', async () => {
    const no = await verifyAndSettle(mock, 'nope', requirements(mock, '/x', 0.01, 'x'));
    expect(no.ok).toBe(false);
    const c = await charge(mock, req({ 'PAYMENT-SIGNATURE': 'mock' }), 'rates', 0.01, 'x');
    expect('settlement' in c).toBe(true);
    if (!('settlement' in c)) return;
    expect(c.settlement.tx.startsWith('mock-')).toBe(true);
    expect(settlementHeaders(c.settlement)['PAYMENT-RESPONSE']).toBeTruthy();
    const found = await findX402PaymentByTx(mock, c.settlement.tx);
    expect(found?.endpoint).toBe('rates');
    expect(found?.amount_usd).toBe(0.01);
    await markX402Refund(mock, c.payment.id, 'test');
    const today = new Date().toISOString().slice(0, 10);
    let s = await x402Summary(mock, today, today);
    expect(s.calls).toBeGreaterThanOrEqual(1);
    expect(s.refunds_owed.some((p) => p.id === c.payment.id)).toBe(true);
    await markX402Refunded(mock, c.payment.id);
    s = await x402Summary(mock, today, today);
    expect(s.refunds_owed.some((p) => p.id === c.payment.id)).toBe(false);
  });
});
