// Meest America: parcels to Ukraine, Poland, the Baltics, Moldova, the Caucasus and Central Asia. The
// store is a Meest agent (the Meest mark is on the banner), so Meest sits beside the four big
// carriers on every quote (v1.71.0).
//
// Rates come from src/data/meest-rates.json, the agent rate sheet the owners edit: a base plus a
// price per pound per country, two services (air, economy by sea where offered). No API call is
// needed to quote, so Meest shows in mock mode and on the live site alike.
//
// Labels: Meest parcels are created in the Meest agent portal with the customs list, so the counter
// finishes them. buyLabel therefore returns a "counter" label: no PDF, a PeterShip reference as the
// tracking placeholder, and the instruction text. When Meest gives the store API access, set
// MEEST_API_URL and MEEST_API_KEY and fill in `apiBuy` below (the request shape is theirs to confirm;
// GitHub issue 17). Until then the quote, the payment and the order record all work; only the paper
// is made by hand.
import type { Provider, Address, Parcel, Rate, Label } from '../types';
import table from '../../data/meest-rates.json';

type Svc = 'air' | 'economy';
interface Country { name: string; air?: { base_usd: number; per_lb_usd: number }; economy?: { base_usd: number; per_lb_usd: number } }
const countries = table.countries as Record<string, Country>;
const services = table.services as Record<Svc, { name: string; min_days: number; max_days: number }>;

export const MEEST_COUNTRIES = Object.keys(countries);
export const meestServes = (country_alpha2: string) => !!countries[country_alpha2.toUpperCase()];

/** Price for one service to one country, or null when Meest does not offer it there. */
export function meestPrice(country_alpha2: string, svc: Svc, weight_lb: number): number | null {
  const c = countries[country_alpha2.toUpperCase()];
  const r = c?.[svc];
  if (!r) return null;
  const lb = Math.max(Math.ceil(weight_lb), table.min_lb);
  return Math.round((r.base_usd + r.per_lb_usd * lb) * 100) / 100;
}

export const meest: Provider = {
  id: 'meest',
  // Always on: the rate table needs no keys. Labels need the counter (or the API once it exists).
  configured: () => true,

  async rates(_env: Env, _origin: Address, destination: Address, parcel: Parcel): Promise<Rate[]> {
    if (!meestServes(destination.country_alpha2)) return [];
    const lb = Math.max(Math.ceil(parcel.weight_lb), table.min_lb);
    return (Object.keys(services) as Svc[]).flatMap((svc) => {
      const price = meestPrice(destination.country_alpha2, svc, parcel.weight_lb);
      if (price === null) return [];
      const s = services[svc];
      return [{ id: `meest:${svc}`, carrier: 'Meest' as const, service: s.name, cost: price, total_charge: price, currency: 'USD', min_days: s.min_days, max_days: s.max_days, billable_weight_lb: lb }];
    });
  },

  async buyLabel(env: Env, origin: Address, destination: Address, parcel: Parcel, serviceCode: string, opts): Promise<Label> {
    const s = services[serviceCode as Svc];
    if (!s) throw new Error(`Unknown Meest service ${serviceCode}`);
    if (env.MEEST_API_URL && env.MEEST_API_KEY) return apiBuy(env, origin, destination, parcel, serviceCode as Svc, opts);
    // Counter label: the parcel is entered in the Meest agent portal when the customer brings it in.
    const ref = 'MEEST-' + Date.now().toString(36).toUpperCase();
    return {
      id: `meest:${ref}`, carrier: 'Meest', service: s.name,
      label_url: null, label_zpl: null, qr_url: null,
      tracking_number: null, tracking_page_url: 'https://meest.com/en/tracking',
      cost: meestPrice(destination.country_alpha2, serviceCode as Svc, parcel.weight_lb) ?? 0,
      counter_note: 'Meest parcel: finished at the counter in the Meest agent portal (customs list, recipient phone). Bring the box in.',
    };
  },

  async track(_env: Env, _trackingNumber: string) {
    // Meest tracking is on meest.com until the API exists; the /track page shows the link.
    return [];
  },
};

/** Meest partner API purchase. Shape unconfirmed; left as the one function to fill in when Meest sends the docs. */
async function apiBuy(env: Env, origin: Address, destination: Address, parcel: Parcel, svc: Svc, _opts: { qr: boolean; zpl: boolean }): Promise<Label> {
  const res = await fetch(`${env.MEEST_API_URL!.replace(/\/$/, '')}/parcels`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.MEEST_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: svc, sender: origin, recipient: destination, parcel }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meest: ${res.status} ${j.message ?? ''}`);
  return {
    id: `meest:${j.id ?? j.parcel_id}`, carrier: 'Meest', service: services[svc].name,
    label_url: j.label_url ?? null, label_zpl: null, qr_url: null,
    tracking_number: j.tracking_number ?? null, tracking_page_url: j.tracking_number ? `https://meest.com/en/tracking?number=${j.tracking_number}` : null,
    cost: Number(j.price ?? meestPrice(destination.country_alpha2, svc, parcel.weight_lb) ?? 0),
  };
}
