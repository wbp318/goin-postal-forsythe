// Small helpers shared by the carrier adapters: JSON calls with clear errors, and an
// OAuth client-credentials token cached in KV for its lifetime.
import { CarrierError, type CarrierId } from './types';

export async function callJson<T = any>(carrier: CarrierId, url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.errors?.[0]?.message ?? body?.response?.errors?.[0]?.message ?? body?.detail ?? body?.raw ?? res.statusText;
    throw new CarrierError(carrier, String(msg), res.status);
  }
  return body as T;
}

/** OAuth2 client-credentials token, cached in KV under the carrier's name until shortly before it expires. */
export async function oauthToken(env: Env, carrier: CarrierId, tokenUrl: string, clientId: string, clientSecret: string, style: 'json' | 'basic-form' | 'form'): Promise<string> {
  const key = `oauth:${carrier}`;
  const cached = env.ORDERS ? await env.ORDERS.get(key) : null;
  if (cached) return cached;
  let init: RequestInit;
  if (style === 'json') {
    init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }) };
  } else if (style === 'basic-form') {
    init = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`) }, body: 'grant_type=client_credentials' };
  } else {
    init = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString() };
  }
  const json = await callJson<{ access_token: string; expires_in?: number }>(carrier, tokenUrl, init);
  const ttl = Math.max(60, Math.min(Number(json.expires_in ?? 3600) - 120, 60 * 60 * 24));
  if (env.ORDERS) await env.ORDERS.put(key, json.access_token, { expirationTtl: ttl });
  return json.access_token;
}

export const money = (v: any) => Math.round(Number(v) * 100) / 100;
