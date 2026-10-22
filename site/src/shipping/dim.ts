// Billable weight. Carriers charge the greater of actual weight and dimensional weight,
// then round up. The divisors and thresholds are the carriers' published 2026 rules
// and live here so a change is one line.
import type { Parcel, Rate } from './types';

const DIVISOR: Record<Rate['carrier'], number> = { USPS: 166, UPS: 139, FedEx: 139, DHL: 139 };

export function cubicInches(p: Parcel) {
  return p.length_in * p.width_in * p.height_in;
}

export function dimWeightLb(carrier: Rate['carrier'], p: Parcel) {
  const cubic = cubicInches(p);
  // USPS applies dimensional weight only above one cubic foot.
  if (carrier === 'USPS' && cubic <= 1728) return 0;
  return cubic / DIVISOR[carrier];
}

/** Pounds the carrier bills for. USPS bills in ounces under a pound; the others round up to the next pound. */
export function billableWeightLb(carrier: Rate['carrier'], p: Parcel) {
  const w = Math.max(p.weight_lb, dimWeightLb(carrier, p));
  if (carrier === 'USPS' && w < 1) return Math.ceil(w * 16) / 16;
  return Math.ceil(w);
}

/** Oversize check the quote page can show before calling carriers. Length plus girth. */
export function lengthPlusGirth(p: Parcel) {
  const [l, w, h] = [p.length_in, p.width_in, p.height_in].sort((a, b) => b - a);
  return l + 2 * (w + h);
}
