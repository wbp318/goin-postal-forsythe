import type { Address, Parcel } from '../shipping/types';

const US_STATES = /^[A-Z]{2}$/;

export function parseAddress(v: any): Address {
  const req = (k: string) => {
    const s = String(v?.[k] ?? '').trim();
    if (!s) throw new Error(`Missing ${k.replace(/_/g, ' ')}`);
    return s;
  };
  const country = req('country_alpha2').toUpperCase();
  const state = String(v?.state ?? '').trim().toUpperCase();
  if (country === 'US' && !US_STATES.test(state)) throw new Error('State must be the two-letter code');
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

export function parseParcel(v: any): Parcel {
  const num = (k: string, min: number, max: number) => {
    const n = Number(v?.[k]);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${k.replace(/_/g, ' ')} must be between ${min} and ${max}`);
    return n;
  };
  return {
    weight_lb: num('weight_lb', 0.1, 150),
    length_in: num('length_in', 1, 108),
    width_in: num('width_in', 1, 108),
    height_in: num('height_in', 1, 108),
    description: String(v?.description ?? '').trim().slice(0, 80),
    value_usd: Number(v?.value_usd) > 0 ? Number(v.value_usd) : 1,
  };
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
