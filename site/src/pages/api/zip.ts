// ZIP to city and state (v1.73.0), so the ship page fills the city and state the moment a US ZIP is
// typed. Looks the ZIP up through Zippopotam (a free public lookup, no key), caches the answer in KV
// for a month, and answers {} when nothing is known. The browser only ever talks to this site.
export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { stateForZip } from '../../lib/address';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });

export const GET: APIRoute = async ({ url }) => {
  const zip = (url.searchParams.get('zip') ?? '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return json({ error: 'A five-digit US ZIP code' }, 400);
  const key = `zip:${zip}`;
  if (env.ORDERS) {
    const hit = await env.ORDERS.get(key);
    if (hit) return json(JSON.parse(hit));
  }
  let out: { city?: string; state?: string } = {};
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const j: any = await res.json();
      const p = j.places?.[0];
      if (p) out = { city: p['place name'], state: p['state abbreviation'] };
    }
  } catch { /* the state guess below still answers */ }
  if (!out.state) { const st = stateForZip(zip); if (st.length === 1) out.state = st[0]; }
  if (env.ORDERS && out.city) await env.ORDERS.put(key, JSON.stringify(out), { expirationTtl: 30 * 86400 });
  return json(out);
};
