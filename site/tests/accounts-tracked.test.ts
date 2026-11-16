// Recently tracked and marketing consent (Peter, Nov 14 2026), against the memory branch of the store.
import { describe, it, expect } from 'vitest';
import { recordTracked, listTracked, removeTracked, recordConsent, marketingConsent, EXPORT_TABLES } from '../src/shipping/store';

const env = {} as any;

describe('recently tracked', () => {
  it('lists newest first, moves a repeat to the top, and keeps customers apart', async () => {
    await recordTracked(env, { customer_id: 'C-A', query: 'gp-aaa111', label: 'First' });
    await new Promise((r) => setTimeout(r, 5));
    await recordTracked(env, { customer_id: 'C-A', query: '1Z999AA10123456784', carrier: 'UPS' });
    await new Promise((r) => setTimeout(r, 5));
    await recordTracked(env, { customer_id: 'C-A', query: 'GP-AAA111' });
    await recordTracked(env, { customer_id: 'C-B', query: 'GP-BBB222' });
    const a = await listTracked(env, 'C-A');
    expect(a.map((r) => r.query)).toEqual(['GP-AAA111', '1Z999AA10123456784']);
    expect(a[0].label).toBe('First'); // a repeat keeps what was known
    expect((await listTracked(env, 'C-B')).map((r) => r.query)).toEqual(['GP-BBB222']);
  });
  it('removes one entry', async () => {
    await removeTracked(env, 'C-A', '1z999aa10123456784');
    expect((await listTracked(env, 'C-A')).map((r) => r.query)).toEqual(['GP-AAA111']);
  });
});

describe('marketing consent', () => {
  it('is no until the customer says yes, and follows their newest choice per channel', async () => {
    expect(await marketingConsent(env, 'C-M')).toEqual({ email: false, sms: false });
    await recordConsent(env, { customer_id: 'C-M', channel: 'sms', granted: true, contact: '3185550100', wording: 'Text me deals', source: 'ship_page' });
    expect(await marketingConsent(env, 'C-M')).toEqual({ email: false, sms: true });
    await new Promise((r) => setTimeout(r, 5));
    await recordConsent(env, { customer_id: 'C-M', channel: 'sms', granted: false, contact: '3185550100', wording: 'STOP', source: 'stop_reply' });
    expect(await marketingConsent(env, 'C-M')).toEqual({ email: false, sms: false });
  });
  it('both new tables are in the staff export', () => {
    expect(EXPORT_TABLES).toContain('customer_tracked');
    expect(EXPORT_TABLES).toContain('marketing_consents');
  });
});

import { safeNext } from '../src/lib/session';
describe('safeNext: where the sign-in link returns to', () => {
  it('allows paths on this site', () => {
    expect(safeNext('/ship?resume=1')).toBe('/ship?resume=1');
    expect(safeNext('/track')).toBe('/track');
  });
  it('refuses other sites and tricks, falling back to the account page', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, '/a b']) expect(safeNext(bad)).toBe('/account');
  });
});
