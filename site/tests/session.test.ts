// Customer accounts (T20): login tokens, the signed cookie, saved addresses.
import { describe, it, expect } from 'vitest';
import { createLoginToken, consumeLoginToken, signSession, readSession, sessionCookie } from '../src/lib/session';
import * as store from '../src/shipping/store';

const env = { SITE_URL: 'http://localhost', SESSION_SECRET: 'test-secret' } as any;

describe('magic link', () => {
  it('a token works once and names the email', async () => {
    const t = await createLoginToken(env, ' Jane@Example.com ');
    expect(t).toMatch(/^[0-9a-f]{48}$/);
    expect(await consumeLoginToken(env, t)).toBe('jane@example.com');
    expect(await consumeLoginToken(env, t)).toBeNull();
    expect(await consumeLoginToken(env, 'nope')).toBeNull();
  });
});

describe('session cookie', () => {
  it('round-trips, rejects tampering, another secret, and expiry', async () => {
    const v = await signSession(env, 'C-1');
    const header = sessionCookie(v, false);
    expect(header).toMatch(/^gp_customer=.*HttpOnly; SameSite=Lax$/);
    expect(await readSession(env, `other=1; ${header.split(';')[0]}`)).toBe('C-1');
    expect(await readSession(env, `gp_customer=${v.replace('C-1', 'C-2')}`)).toBeNull();
    expect(await readSession({ ...env, SESSION_SECRET: 'different' }, `gp_customer=${v}`)).toBeNull();
    expect(await readSession(env, `gp_customer=${v}`, Date.now() + 91 * 86_400_000)).toBeNull();
    expect(await readSession(env, null)).toBeNull();
  });
});

describe('saved addresses', () => {
  it('saves, lists, fetches one, deletes only the owner\'s', async () => {
    const cid = (await store.upsertCustomer(env, { name: 'Acct Tester', email: 'acct@example.com' }))!;
    const a = await store.saveCustomerAddress(env, { customer_id: cid, label: 'Mom', address_json: '{"line_1":"1 Main"}' });
    expect((await store.listCustomerAddresses(env, cid)).map((x) => x.label)).toEqual(['Mom']);
    expect((await store.getCustomerAddress(env, cid, a.id))?.label).toBe('Mom');
    expect(await store.deleteCustomerAddress(env, 'someone-else', a.id)).toBe(false);
    expect(await store.deleteCustomerAddress(env, cid, a.id)).toBe(true);
    await store.setCustomerName(env, cid, 'Renamed', null);
    expect((await store.getCustomer(env, cid))?.name).toBe('Renamed');
  });
});
