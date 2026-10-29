// The Pirate Ship benchmark (T26, agenda item 54): what Pirate Ship would charge for USPS Ground
// Advantage on the same parcel, shown beside the store's price so the sales conversation and the
// weekly report have a number. The table is src/data/benchmarks.json; most cells are interpolated
// from the published points and flagged estimated until the owners paste the full chart.
import table from '../data/benchmarks.json';
import type { Address, Parcel, Rate } from '../shipping/types';

const T = table as {
  estimated: boolean; service: string; as_of: string;
  under_1_lb_by_zone: Record<string, number>; zone5_by_lb: Record<string, number>; zone_factor_vs_zone5: Record<string, number>; zones_from_louisiana_by_state: Record<string, number>;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The USPS zone from the store to a US state, from a hand-made table for a Louisiana origin. Null outside the US or for an unknown state. */
export function zoneFor(to: Pick<Address, 'state' | 'country_alpha2'>): number | null {
  if (to.country_alpha2 !== 'US') return null;
  return T.zones_from_louisiana_by_state[to.state.toUpperCase()] ?? null;
}

/** Pirate Ship's Ground Advantage price for a zone and a billable weight, interpolated between the table's weight breaks. */
export function pirateShipGroundAdvantage(zone: number, weightLb: number): number | null {
  const z = String(Math.min(9, Math.max(1, Math.round(zone))));
  if (weightLb <= 0) return null;
  if (weightLb < 1) return T.under_1_lb_by_zone[z] ?? null;
  if (weightLb > 70) return null;
  const breaks = Object.keys(T.zone5_by_lb).map(Number).sort((a, b) => a - b);
  const w = Math.ceil(weightLb); // USPS bills whole pounds above one
  let lo = breaks[0], hi = breaks[breaks.length - 1];
  for (const b of breaks) { if (b <= w) lo = b; if (b >= w) { hi = b; break; } }
  const plo = T.zone5_by_lb[String(lo)], phi = T.zone5_by_lb[String(hi)];
  const z5 = lo === hi ? plo : plo + (phi - plo) * (w - lo) / (hi - lo);
  return r2(z5 * (T.zone_factor_vs_zone5[z] ?? 1));
}

export interface Benchmark { service: string; zone: number; pirate_ship: number; store: number | null; diff: number | null; estimated: boolean; as_of: string }

/** The benchmark for a quote: Pirate Ship's Ground Advantage against the store's cheapest USPS ground rate. Null when it does not apply (international, no weight). */
export function benchmarkFor(to: Address, parcel: Pick<Parcel, 'weight_lb'>, rates: Pick<Rate, 'carrier' | 'service' | 'total_charge' | 'billable_weight_lb'>[]): Benchmark | null {
  const zone = zoneFor(to);
  if (zone == null) return null;
  const usps = rates.filter((r) => r.carrier === 'USPS' && /ground advantage|first.class|parcel select/i.test(r.service)).sort((a, b) => a.total_charge - b.total_charge)[0];
  const weight = usps?.billable_weight_lb ?? parcel.weight_lb;
  const ps = pirateShipGroundAdvantage(zone, weight);
  if (ps == null) return null;
  return { service: T.service, zone, pirate_ship: ps, store: usps ? r2(usps.total_charge) : null, diff: usps ? r2(usps.total_charge - ps) : null, estimated: T.estimated, as_of: T.as_of };
}
