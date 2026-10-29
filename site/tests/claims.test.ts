// Claims (T13): the store's records, the stages, and the thirty-day flag.
import { describe, it, expect } from 'vitest';
import * as store from '../src/shipping/store';

const env = {} as any;

describe('claims', () => {
  it('opens, files, decides, refunds and closes a claim, listing open ones only by default', async () => {
    const c = await store.createClaim(env, { code: 'CL-TEST01', shipment_id: 'GP-CLAIM1', kind: 'lost', carrier: 'USPS', tracking_number: '9400', declared_usd: 100, postage_usd: 8.69, claimed_usd: 108.69, insured: 1, customer_name: 'Jane', customer_email: 'j@example.com', customer_phone: null, notes: null, by_name: 'Tester' });
    expect(c.status).toBe('open');
    expect(store.newClaimCode()).toMatch(/^CL-[A-Z2-9]{6}$/);
    const filed = await store.updateClaim(env, 'cl-test01', { status: 'filed', carrier_claim_number: 'USPS-123', filed_at: '2026-09-01T00:00:00Z' });
    expect(filed?.status).toBe('filed');
    const open = await store.listClaims(env);
    expect(open.some((x) => x.code === 'CL-TEST01')).toBe(true);
    expect(Date.now() - Date.parse(filed!.filed_at!) > store.REMIND_DAYS * 86_400_000).toBe(true); // the flag the page shows
    await store.updateClaim(env, c.code, { status: 'approved', decided_at: '2026-10-01T00:00:00Z', carrier_paid_usd: 100 });
    await store.updateClaim(env, c.code, { status: 'refunded', customer_refund_usd: 100, refund_via: 'pos', refunded_at: '2026-10-02T00:00:00Z' });
    const closed = await store.updateClaim(env, c.code, { status: 'closed', closed_at: '2026-10-03T00:00:00Z' });
    expect(closed).toMatchObject({ status: 'closed', customer_refund_usd: 100, carrier_paid_usd: 100 });
    expect((await store.listClaims(env)).some((x) => x.code === 'CL-TEST01')).toBe(false);
    expect((await store.listClaims(env, true)).some((x) => x.code === 'CL-TEST01')).toBe(true);
    expect(await store.updateClaim(env, 'CL-NOPE', { notes: 'x' })).toBeNull();
  });
});
