import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { peekLoginToken, consumeLoginTokenFull, signSession, readSession, endSessions } from '../src/lib/session';
import { overLimit, resetLimit } from '../src/lib/limits';
import * as store from '../src/shipping/store';

// Sign-up links, sessions and limits (Nov 15 2026).
const E = env as any;
const call = async (body: Record<string, unknown>, ip = `t-${Math.random()}`) => {
  const { POST } = await import('../src/pages/api/account');
  const res = await (POST as any)({ request: new Request('http://x/api/account', { method: 'POST', body: JSON.stringify(body), headers: { 'cf-connecting-ip': ip } }) });
  return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie') };
};
const tokenOf = (link: string) => String(link).match(/token=([0-9a-f]+)/)![1];

describe('sign-up links', () => {
  it('a new email gets a sign-up link that opening alone does not use up', async () => {
    const r = await call({ action: 'signup', name: 'New Person', email: 'links-new@example.com', phone: '3185550101', password: 'river road at noon' });
    expect(r.status).toBe(200);
    const tok = tokenOf(r.body.mock_link);
    expect((await peekLoginToken(E, tok))?.pw).toBeTruthy();
    expect((await peekLoginToken(E, tok))?.pw).toBeTruthy(); // still there after a look
    expect((await consumeLoginTokenFull(E, tok))?.email).toBe('links-new@example.com');
    expect(await peekLoginToken(E, tok)).toBeNull();
  });

  it('an email that has an account gets a plain sign-in link, with no password in it', async () => {
    await store.upsertCustomer(E, { name: 'Has Account', email: 'links-old@example.com' });
    const r = await call({ action: 'signup', name: 'Someone Else', email: 'links-old@example.com', phone: '3185550102', password: 'a different password' });
    expect(r.status).toBe(200);
    expect(r.body.sent).toBe(true);
    const t = await peekLoginToken(E, tokenOf(r.body.mock_link));
    expect(t?.email).toBe('links-old@example.com');
    expect(t?.pw).toBeUndefined();
    expect(t?.phone).toBeUndefined();
  });
});

describe('sessions', () => {
  it('a password change signs out older cookies, and the new cookie works', async () => {
    const old = await signSession(E, 'C-links-1');
    expect(await readSession(E, `gp_customer=${old}`)).toBe('C-links-1');
    await endSessions(E, 'C-links-1');
    expect(await readSession(E, `gp_customer=${old}`)).toBeNull();
    const fresh = await signSession(E, 'C-links-1');
    expect(await readSession(E, `gp_customer=${fresh}`)).toBe('C-links-1');
  });

  it('a cookie can not claim another session number', async () => {
    await endSessions(E, 'C-links-2');
    const v = await signSession(E, 'C-links-2'); // number 1
    const forged = v.replace(/\.1\./, '.2.');
    expect(await readSession(E, `gp_customer=${forged}`)).toBeNull();
  });
});

describe('limits', () => {
  it('counts every try, so the sixth in the window is over a limit of five', async () => {
    const key = `test:${Math.random()}`;
    const res: boolean[] = [];
    for (let i = 0; i < 6; i++) res.push(await overLimit(E, key, 5));
    expect(res).toEqual([false, false, false, false, false, true]);
    await resetLimit(E, key);
    expect(await overLimit(E, key, 5)).toBe(false);
  });

  it('a counter starts again after its window', async () => {
    const k = `win:${Math.random()}`;
    expect(await store.bumpCounter(E, k, 60, 1_000)).toBe(1);
    expect(await store.bumpCounter(E, k, 60, 2_000)).toBe(2);
    expect(await store.readCounter(E, k, 2_000)).toBe(2);
    expect(await store.bumpCounter(E, k, 60, 1_000 + 61_000)).toBe(1);
  });

  it('wrong passwords from one address do not lock the email for another address', async () => {
    await store.upsertCustomer(E, { name: 'Lock Test', email: 'links-lock@example.com' });
    for (let i = 0; i < 5; i++) expect((await call({ action: 'password_login', email: 'links-lock@example.com', password: 'nope nope nope' }, 'ip-a')).status).toBe(401);
    expect((await call({ action: 'password_login', email: 'links-lock@example.com', password: 'nope nope nope' }, 'ip-a')).status).toBe(429);
    expect((await call({ action: 'password_login', email: 'links-lock@example.com', password: 'nope nope nope' }, 'ip-b')).status).toBe(401);
  });
});
