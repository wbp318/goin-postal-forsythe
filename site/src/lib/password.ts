// Customer passwords (Peter, Nov 14 2026). Never stored as typed: PBKDF2-SHA256 with a random 16-byte salt,
// 100,000 rounds (the most Cloudflare Workers allow), compared in constant time. Rules follow NIST's advice:
// at least 8 characters, long passwords welcome, no "one capital and one symbol" rules, the most common
// passwords refused. Pure WebCrypto: works in Workers, tests and browsers.
export const PBKDF2_ROUNDS = 100_000;
export interface PasswordHash { hash: string; salt: string; iter: number }

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256);
  return b64(bits);
}

export async function hashPassword(password: string, iter = PBKDF2_ROUNDS): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derive(password, salt, iter), salt: b64(salt), iter };
}

export async function verifyPassword(password: string, rec: PasswordHash | null | undefined): Promise<boolean> {
  if (!rec?.hash || !rec.salt) return false;
  const got = await derive(password, unb64(rec.salt), rec.iter || PBKDF2_ROUNDS);
  if (got.length !== rec.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ rec.hash.charCodeAt(i);
  return diff === 0;
}

// The passwords people pick most, which attackers try first.
const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop', '11111111', '00000000', 'iloveyou', 'abc12345', 'letmein1', 'welcome1', 'sunshine', 'football', 'baseball', 'princess', 'admin123', 'passw0rd', 'goinpostal', 'monroe123']);

/** Why a password can't be used, as a short code the page translates; null when it's fine. */
export function passwordProblem(password: string, email = ''): 'short' | 'long' | 'common' | null {
  const p = String(password ?? '');
  if (p.length < 8) return 'short';
  if (p.length > 128) return 'long';
  const low = p.toLowerCase();
  if (COMMON.has(low) || (email && low === email.trim().toLowerCase()) || /^(.)\1+$/.test(p)) return 'common';
  return null;
}
