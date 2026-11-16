// Customer accounts online (to-do T20): a magic link instead of a password. The customer types
// their email, gets a link with a one-time token (KV, fifteen minutes), and clicking it sets a
// signed cookie that names the customer record for ninety days. No password to forget, nothing
// to leak. The signing secret is SESSION_SECRET; without one (the dev server) a fixed string is
// used, which is fine locally and useless in production, so set the secret with wrangler.
const COOKIE = 'gp_customer';
const DAYS = 90;
const memory = new Map<string, string>();
const kv = (env: Env) => env.ORDERS ?? ({ get: async (k: string) => memory.get(k) ?? null, put: async (k: string, v: string) => { memory.set(k, v); }, delete: async (k: string) => { memory.delete(k); } } as unknown as KVNamespace);

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
async function hmac(env: Env, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET || `dev-only-${env.SITE_URL ?? ''}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

/** A one-time login token for this email, kept fifteen minutes. */
export async function createLoginToken(env: Env, email: string): Promise<string> {
  const token = hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
  await kv(env).put(`login:${token}`, email.trim().toLowerCase(), { expirationTtl: 15 * 60 });
  return token;
}
/** The email a token was made for, and the token is burnt. Null when unknown or used. */
export async function consumeLoginToken(env: Env, token: string): Promise<string | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const email = await kv(env).get(`login:${token}`);
  if (email) await kv(env).delete(`login:${token}`);
  return email;
}

// A customer's session number (Nov 15 2026): every cookie carries it, and a password change moves it on, which
// signs out every cookie made before. Cookies from before this have no number and count as 0.
const sessionVer = async (env: Env, id: string) => Number(await kv(env).get(`sv:${id}`)) || 0;
/** Signs out every session this customer has; sign the current one again afterwards to stay signed in. */
export async function endSessions(env: Env, customerId: string): Promise<void> {
  await kv(env).put(`sv:${customerId}`, String((await sessionVer(env, customerId)) + 1));
}

/** The cookie value for a customer: id.expiry.session-number.signature. */
export async function signSession(env: Env, customerId: string, now = Date.now()): Promise<string> {
  const exp = now + DAYS * 86_400_000;
  const body = `${customerId}.${exp}.${await sessionVer(env, customerId)}`;
  return `${body}.${await hmac(env, body)}`;
}
/** The customer id a cookie header names, or null when missing, tampered, expired or signed out. */
export async function readSession(env: Env, cookieHeader: string | null, now = Date.now()): Promise<string | null> {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(cookieHeader ?? '');
  if (!m) return null;
  const parts = decodeURIComponent(m[1]).split('.');
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [id, exp] = parts;
  const ver = parts.length === 4 ? parts[2] : '0';
  const sig = parts[parts.length - 1];
  if (!/^\d+$/.test(exp) || !/^\d+$/.test(ver) || Number(exp) < now) return null;
  const want = await hmac(env, parts.slice(0, -1).join('.'));
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  return Number(ver) === (await sessionVer(env, id)) ? id : null;
}
export const sessionCookie = (value: string, secure: boolean) => `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${DAYS * 86_400}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
