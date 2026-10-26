// PeterShip's rating engine. Asks every configured carrier in parallel, normalizes, applies the
// store's retail rules, caches for five minutes, and returns one list sorted by price.
// If a carrier is down the others still answer; the failure is logged, never shown.
import type { Address, Parcel, Rate, Label, TrackingEvent } from './types';
import { usps } from './providers/usps';
import { ups } from './providers/ups';
import { fedex } from './providers/fedex';
import { dhl } from './providers/dhl';
import { easyship } from './providers/easyship';
import { retail } from '../lib/pricing';
import { lengthPlusGirth } from './dim';

const DIRECT = [usps, ups, fedex, dhl];
const CACHE_TTL = 300;

export function activeProviders(env: Env) {
  const direct = DIRECT.filter((p) => p.configured(env));
  // Direct carriers answer for themselves. Easyship fills in any carrier with no direct adapter yet,
  // and is the only source when none are configured (including mock mode).
  return { direct, fallback: easyship };
}

function cacheKey(o: Address, d: Address, p: Parcel) {
  const round = (n: number) => Math.round(n * 10) / 10;
  return `rates:${o.postal_code}:${d.country_alpha2}:${d.postal_code}:${round(p.weight_lb)}:${round(p.length_in)}x${round(p.width_in)}x${round(p.height_in)}:${d.residential ? 'r' : 'c'}`;
}

export interface QuoteResult { rates: Rate[]; demo: boolean; errors: { carrier: string; message: string }[]; oversize: boolean }

export async function getQuotes(env: Env, origin: Address, destination: Address, parcel: Parcel): Promise<QuoteResult> {
  const oversize = lengthPlusGirth(parcel) > 130;
  const key = cacheKey(origin, destination, parcel);
  if (env.ORDERS) {
    const hit = await env.ORDERS.get(key);
    if (hit) return { ...(JSON.parse(hit) as QuoteResult), oversize };
  }

  const { direct, fallback } = activeProviders(env);
  const errors: QuoteResult['errors'] = [];
  const results = await Promise.all(direct.map((p) => p.rates(env, origin, destination, parcel).catch((e) => { errors.push({ carrier: p.id, message: String(e.message) }); return [] as Rate[]; })));
  let rates = results.flat();

  const covered = new Set(rates.map((r) => r.carrier));
  const missing = (['USPS', 'UPS', 'FedEx', 'DHL'] as const).filter((c) => !covered.has(c));
  if (missing.length) {
    const fill = await fallback.rates(env, origin, destination, parcel).catch((e) => { errors.push({ carrier: 'fallback', message: String(e.message) }); return [] as Rate[]; });
    rates = rates.concat(fill.filter((r) => missing.includes(r.carrier)));
  }

  rates = retail(rates).sort((a, b) => a.total_charge - b.total_charge);
  const demo = direct.length === 0 && !env.EASYSHIP_TOKEN;
  const out: QuoteResult = { rates, demo, errors, oversize };
  if (env.ORDERS && rates.length) await env.ORDERS.put(key, JSON.stringify(out), { expirationTtl: CACHE_TTL });
  return out;
}

/** Routes a label purchase to whichever adapter produced the rate id. */
export async function buyLabel(env: Env, origin: Address, destination: Address, parcel: Parcel, rateId: string, opts: { qr: boolean; zpl: boolean }): Promise<Label> {
  const [carrier, code] = rateId.split(':');
  const provider = [...DIRECT, easyship].find((p) => p.id === carrier);
  if (!provider) throw new Error(`Unknown rate ${rateId}`);
  return provider.buyLabel(env, origin, destination, parcel, code, opts);
}

/** Every provider's answer side by side, for the parity test before switching Easyship off. */
export async function compare(env: Env, origin: Address, destination: Address, parcel: Parcel) {
  const all = [...DIRECT, easyship];
  const rows = await Promise.all(all.map(async (p) => {
    if (!p.configured(env)) return { provider: p.id, configured: false, rates: [] as Rate[], error: null as string | null };
    try { return { provider: p.id, configured: true, rates: await p.rates(env, origin, destination, parcel), error: null }; }
    catch (e: any) { return { provider: p.id, configured: true, rates: [], error: String(e.message) }; }
  }));
  return rows;
}

function providerFor(id: string) {
  const provider = [...DIRECT, easyship].find((p) => p.id === id.split(':')[0]);
  if (!provider) throw new Error(`Unknown provider in ${id}`);
  return provider;
}

/** Void a bought label. Routed by the label id prefix, same as buying. Easyship labels cannot be voided through us yet. */
export async function voidLabel(env: Env, labelId: string): Promise<void> {
  const provider = providerFor(labelId);
  if (!provider.voidLabel) throw new Error(`${provider.id} labels cannot be voided from here`);
  await provider.voidLabel(env, labelId);
}

/** Latest carrier events for a shipment, newest first. Routed by the label id prefix. Returns [] when the adapter has no tracking. */
export async function track(env: Env, labelId: string, trackingNumber: string): Promise<TrackingEvent[]> {
  const provider = providerFor(labelId);
  if (!provider.track) return [];
  const events = await provider.track(env, trackingNumber.replace(/\s+/g, ''));
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
