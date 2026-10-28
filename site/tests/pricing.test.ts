// Dimensional weight and the retail rules: the arithmetic every quote depends on.
import { describe, it, expect } from 'vitest';
import { billableWeightLb, dimWeightLb, lengthPlusGirth } from '../src/shipping/dim';
import { applyRules, rulesFromFile } from '../src/lib/pricing';
import type { Rate } from '../src/shipping/types';

const parcel = (w: number, l: number, wd: number, h: number) => ({ weight_lb: w, length_in: l, width_in: wd, height_in: h, description: '', value_usd: 1 });
const rate = (carrier: Rate['carrier'], service: string, cost: number): Rate => ({ id: `x:${service}`, carrier, service, cost, total_charge: cost, currency: 'USD', min_days: 1, max_days: 3 });

describe('dimensional weight', () => {
  it('USPS ignores size under a cubic foot, bills ounces under a pound', () => {
    expect(dimWeightLb('USPS', parcel(0.5, 12, 12, 11))).toBe(0);
    expect(billableWeightLb('USPS', parcel(0.5, 12, 12, 11))).toBe(0.5);
    expect(billableWeightLb('USPS', parcel(0.3, 6, 6, 6))).toBe(0.3125); // rounded up to the next ounce
  });
  it('UPS and FedEx divide by 139 and round up to the pound', () => {
    expect(billableWeightLb('UPS', parcel(2, 20, 16, 12))).toBe(28);   // 3840 / 139 = 27.6
    expect(billableWeightLb('FedEx', parcel(30, 20, 16, 12))).toBe(30); // actual wins
  });
  it('length plus girth flags oversize', () => {
    expect(lengthPlusGirth(parcel(1, 60, 30, 30))).toBe(180);
    expect(lengthPlusGirth(parcel(1, 10, 8, 4))).toBe(34);
  });
});

describe('retail rules', () => {
  const rates = [rate('USPS', 'USPS Ground Advantage', 9.65), rate('UPS', 'UPS Ground', 12.1), rate('USPS', 'USPS Priority Mail', 13.2)];
  it('off: price equals cost', () => {
    const out = applyRules({ enabled: false, round_to_99: true, updated_at: null, rules: [{ scope: 'default', match: null, percent: 50, flat: 5, price: null, active: 1 }] }, rates);
    expect(out.map((r) => r.total_charge)).toEqual([9.65, 12.1, 13.2]);
  });
  it('service beats carrier beats default, with .99 rounding', () => {
    const out = applyRules({ enabled: true, round_to_99: true, updated_at: null, rules: [
      { scope: 'default', match: null, percent: 20, flat: 1, price: null, active: 1 },
      { scope: 'carrier', match: 'UPS', percent: 30, flat: null, price: null, active: 1 },
      { scope: 'service', match: 'USPS Priority Mail', percent: null, flat: null, price: 14.99, active: 1 },
    ] }, rates);
    expect(out.map((r) => r.total_charge)).toEqual([12.99, 15.99, 14.99]);
  });
  it('inactive rows are skipped and no rounding keeps cents', () => {
    const out = applyRules({ enabled: true, round_to_99: false, updated_at: null, rules: [
      { scope: 'default', match: null, percent: 10, flat: 0, price: null, active: 1 },
      { scope: 'carrier', match: 'UPS', percent: 90, flat: null, price: null, active: 0 },
    ] }, rates);
    expect(out[1].total_charge).toBe(13.31);
  });
  it('the seed file has one default row and starts switched off', () => {
    const f = rulesFromFile();
    expect(f.enabled).toBe(false);
    expect(f.rules.filter((r) => r.scope === 'default')).toHaveLength(1);
  });
});
