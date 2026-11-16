import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, passwordProblem } from '../src/lib/password';

describe('passwords are stored scrambled and checked safely', () => {
  it('a password verifies, a different one does not, and the stored value is not the password', async () => {
    const rec = await hashPassword('correct horse battery', 1000);
    expect(rec.hash).not.toContain('correct');
    expect(await verifyPassword('correct horse battery', rec)).toBe(true);
    expect(await verifyPassword('correct horse batterY', rec)).toBe(false);
    expect(await verifyPassword('', rec)).toBe(false);
  });
  it('the same password gets a different salt and hash each time', async () => {
    const a = await hashPassword('same password here', 1000), b = await hashPassword('same password here', 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
  it('no stored password means no sign-in', async () => {
    expect(await verifyPassword('anything123', null)).toBe(false);
  });
});

describe('password rules', () => {
  it('needs at least 8 characters and allows long ones', () => {
    expect(passwordProblem('short1')).toBe('short');
    expect(passwordProblem('a long but easy to remember sentence')).toBeNull();
    expect(passwordProblem('x'.repeat(129) + 'y')).toBe('long');
  });
  it('refuses the most common passwords, repeats, and the email itself', () => {
    expect(passwordProblem('Password123')).toBe('common');
    expect(passwordProblem('aaaaaaaaaa')).toBe('common');
    expect(passwordProblem('pat@example.com', 'Pat@example.com')).toBe('common');
  });
});

import { setPasswordHash, getLogin, markEmailVerified, exportTable } from '../src/shipping/store';
describe('stored logins', () => {
  it('keeps the hash for sign-in, and the staff export never shows it', async () => {
    const env = {} as any;
    const h = await hashPassword('a long enough password', 1000);
    await setPasswordHash(env, 'C-PW', h);
    await markEmailVerified(env, 'C-PW');
    const row = await getLogin(env, 'C-PW');
    expect(await verifyPassword('a long enough password', { hash: row!.pw_hash!, salt: row!.pw_salt!, iter: row!.pw_iter! })).toBe(true);
    expect(row!.email_verified_at).toBeTruthy();
    const exported = (await exportTable(env, 'customer_logins')).find((r) => r.customer_id === 'C-PW')!;
    expect(exported.pw_hash).toBe('');
    expect(exported.pw_salt).toBe('');
  });
});
