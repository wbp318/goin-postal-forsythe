// API keys for business accounts (the public API, /api/v1). A key is shown once when it is made and
// stored hashed; a bearer token on a request resolves to the key row and its account. Each key may
// carry a webhook URL and a signing secret: tracking changes for that account's shipments are POSTed
// there with an HMAC so the receiver can trust them.
import { findApiKeyByHash, touchApiKey, getAccount, listWebhookKeys, type ApiKeyRow, type AccountRow, type ShipmentRow } from '../shipping/store';
import type { TrackingEvent } from '../shipping/types';

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** A fresh key, "psk_" + 32 random bytes, and its hash for the table. The plain key is returned to the caller once. */
export async function newApiKey(): Promise<{ plain: string; hash: string; prefix: string }> {
  const plain = 'psk_' + b64url(crypto.getRandomValues(new Uint8Array(32)));
  return { plain, hash: await hashKey(plain), prefix: plain.slice(0, 10) };
}
export const newWebhookSecret = () => 'whsec_' + b64url(crypto.getRandomValues(new Uint8Array(24)));

export async function hashKey(plain: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`gp-apikey:${plain}`)));
}

export interface ApiCaller { key: ApiKeyRow; account: AccountRow }

/** Resolve "Authorization: Bearer psk_..." to the key and its active account, or null. */
export async function authenticateApi(env: Env, request: Request): Promise<ApiCaller | null> {
  const auth = request.headers.get('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(psk_[A-Za-z0-9_-]{20,})$/i);
  if (!m) return null;
  const key = await findApiKeyByHash(env, await hashKey(m[1]));
  if (!key || !key.active) return null;
  const account = await getAccount(env, key.account_id);
  if (!account || !account.active) return null;
  await touchApiKey(env, key.id).catch(() => {});
  return { key, account };
}

export async function sign(secret: string, body: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body)));
}

/** POST a tracking change to every webhook on the shipment's account. Failures are logged, never thrown; the poll goes on. */
export async function deliverWebhooks(env: Env, s: ShipmentRow, fresh: TrackingEvent[]): Promise<number> {
  const keys = await listWebhookKeys(env, s.id);
  if (!keys.length) return 0;
  const latest = [...fresh].sort((a, b) => b.at.localeCompare(a.at))[0];
  const payload = JSON.stringify({ type: 'shipment.tracking', shipment_id: s.id, tracking_number: s.tracking_number, carrier: s.carrier, service: s.service, status: s.status, event: latest, events: fresh, sent_at: new Date().toISOString() });
  let delivered = 0;
  for (const k of keys) {
    if (!k.webhook_url || !k.webhook_secret) continue;
    try {
      const sig = await sign(k.webhook_secret, payload);
      const res = await fetch(k.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PeterShip-Signature': `sha256=${sig}`, 'X-PeterShip-Event': 'shipment.tracking' }, body: payload, signal: AbortSignal.timeout(8000) });
      if (res.ok) delivered++; else console.warn('webhook', k.webhook_url, res.status);
    } catch (e: any) { console.warn('webhook failed', k.webhook_url, e.message); }
  }
  return delivered;
}
