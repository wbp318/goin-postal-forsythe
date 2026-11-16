import type { Address, Parcel } from '../shipping/types';
import { parseOptions } from './options';
import { packagingById } from './packaging';

const US_STATES = /^[A-Z]{2}$/;
// Domestic only (Nov 7, 2026): international shipping is out of PeterShip. Territories and military
// addresses ride as US with their two-letter codes (PR, GU, VI, AS, MP; AA, AE, AP).
export const US_ONLY = 'PeterShip ships within the United States only: the 50 states, DC, Puerto Rico, the US territories and APO, FPO and DPO addresses.';

export function parseAddress(v: any): Address {
  const req = (k: string) => {
    const s = String(v?.[k] ?? '').trim();
    if (!s) throw new Error(`Missing ${k.replace(/_/g, ' ')}`);
    return s;
  };
  const country = String(v?.country_alpha2 ?? 'US').trim().toUpperCase() || 'US';
  if (country !== 'US') throw new Error(US_ONLY);
  const state = String(v?.state ?? '').trim().toUpperCase();
  if (!US_STATES.test(state)) throw new Error('State must be the two-letter code');
  return {
    contact_name: req('contact_name'),
    contact_phone: String(v?.contact_phone ?? '').trim() || undefined,
    contact_email: String(v?.contact_email ?? '').trim() || undefined,
    line_1: req('line_1').slice(0, 35),
    line_2: String(v?.line_2 ?? '').trim().slice(0, 35) || undefined,
    city: req('city'),
    state,
    postal_code: req('postal_code'),
    country_alpha2: country,
  };
}

/** `options: true` only on the Ship page's routes (api/rates.ts, api/orders.ts), which charge for what the
 *  options add (signature) and show what they change. Every other path (the API, x402, the counter queue and
 *  batch) ignores options sent with the parcel, as before they existed. */
export function parseParcel(v: any, opts: { options?: boolean } = {}): Parcel {
  const num = (k: string, min: number, max: number) => {
    const n = Number(v?.[k]);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${k.replace(/_/g, ' ')} must be between ${min} and ${max}`);
    return n;
  };
  // Packaging (Peter, Nov 14 2026): carrier packaging has a known size, so it replaces whatever was typed;
  // a tube or irregular package is priced as irregular; USPS packaging holds up to 70 lb.
  const pk = packagingById(String(v?.packaging ?? ''));
  const weight_lb = num('weight_lb', 0.1, 150);
  if (pk?.maxLb && weight_lb > pk.maxLb) throw new Error(`The ${pk.name} holds up to ${pk.maxLb} lb`);
  const options = opts.options ? parseOptions(v?.options) : {};
  if (pk?.id === 'tube') options.irregular = true;
  return {
    weight_lb,
    length_in: pk?.dims ? pk.dims[0] : num('length_in', 1, 108),
    width_in: pk?.dims ? pk.dims[1] : num('width_in', 1, 108),
    height_in: pk?.dims ? pk.dims[2] : num('height_in', 1, 108),
    description: String(v?.description ?? '').trim().slice(0, 80),
    value_usd: Number(v?.value_usd) > 0 ? Number(v.value_usd) : 1,
    options,
    ...(pk ? { packaging: pk.id } : {}),
  };
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
