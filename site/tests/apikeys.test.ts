// API keys: hashing, bearer resolution, signing, and the store behind them.
import { describe, it, expect } from 'vitest';
import { newApiKey, hashKey, authenticateApi, sign, newWebhookSecret } from '../src/lib/apikeys';
import { addApiKey, listApiKeys, revokeApiKey, addAccount, upsertCustomer, listWebhookKeys, billShipmentToAccount } from '../src/shipping/store';

const env = {} as any;

describe('api keys', () => {
  it('a new key is psk_, long, random, and hashes the same way twice', async () => {
    const a = await newApiKey(), b = await newApiKey();
    expect(a.plain.startsWith('psk_')).toBe(true);
    expect(a.plain.length).toBeGreaterThan(40);
    expect(a.plain).not.toBe(b.plain);
    expect(a.hash).toBe(await hashKey(a.plain));
    expect(newWebhookSecret().startsWith('whsec_')).toBe(true);
  });
  it('a bearer token resolves to its key and account; revoked, closed or wrong ones do not', async () => {
    const cid = (await upsertCustomer(env, { name: 'Api Co', email: 'api@example.com' }))!;
    const acc = await addAccount(env, { customer_id: cid, business_name: 'Api Co', discount_percent: 5, notes: '' });
    const k = await newApiKey();
    const row = await addApiKey(env, { account_id: acc.id, label: 'Shopify', prefix: k.prefix, key_hash: k.hash, webhook_url: 'https://example.com/hook', webhook_secret: 'whsec_x' });
    const req = (token: string) => new Request('https://x/api/v1/me', { headers: { authorization: `Bearer ${token}` } });
    const who = await authenticateApi(env, req(k.plain));
    expect(who?.account.business_name).toBe('Api Co');
    expect(who?.key.label).toBe('Shopify');
    expect(await authenticateApi(env, req('psk_' + 'a'.repeat(43)))).toBeNull();
    expect(await authenticateApi(env, new Request('https://x/', { headers: { authorization: 'Basic abc' } }))).toBeNull();
    const listed = await listApiKeys(env, acc.id);
    expect(listed[0]).not.toHaveProperty('key_hash');
    expect(listed[0]).not.toHaveProperty('webhook_secret');
    await billShipmentToAccount(env, 'GP-HOOK1', acc.id);
    expect((await listWebhookKeys(env, 'GP-HOOK1')).map((x) => x.id)).toEqual([row.id]);
    expect(await revokeApiKey(env, acc.id, row.id)).toBe(true);
    expect(await revokeApiKey(env, acc.id, row.id)).toBe(false);
    expect(await authenticateApi(env, req(k.plain))).toBeNull();
    expect(await listWebhookKeys(env, 'GP-HOOK1')).toEqual([]);
  });
  it('signatures are HMAC-SHA256 hex and change with the body', async () => {
    const s1 = await sign('whsec_test', '{"a":1}'), s2 = await sign('whsec_test', '{"a":2}');
    expect(s1).toMatch(/^[0-9a-f]{64}$/);
    expect(s1).not.toBe(s2);
    expect(await sign('whsec_test', '{"a":1}')).toBe(s1);
  });
});
