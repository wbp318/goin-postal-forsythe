// The Pirate Ship benchmark (T26): zones from Louisiana, the interpolated table, the quote comparison, the log.
import { describe, it, expect } from 'vitest';
import { zoneFor, pirateShipGroundAdvantage, benchmarkFor } from '../src/lib/benchmark';
import * as store from '../src/shipping/store';

const env = {} as any;
const to = (state: string) => ({ contact_name: 'X', line_1: '1 A St', city: 'C', state, postal_code: '00000', country_alpha2: 'US' });

describe('benchmark', () => {
  it('zones: close states low, far states high, nothing abroad', () => {
    expect(zoneFor(to('LA'))).toBe(2);
    expect(zoneFor(to('TX'))).toBe(4);
    expect(zoneFor(to('WA'))).toBe(8);
    expect(zoneFor({ state: '', country_alpha2: 'CA' })).toBeNull();
    expect(zoneFor(to('ZZ'))).toBeNull();
  });
  it('the table: published zone-5 points exact, under a pound flat, other zones scaled, whole pounds', () => {
    expect(pirateShipGroundAdvantage(5, 1)).toBe(8.74);
    expect(pirateShipGroundAdvantage(5, 5)).toBe(13.48);
    expect(pirateShipGroundAdvantage(5, 0.5)).toBe(7.69);
    expect(pirateShipGroundAdvantage(1, 0.5)).toBe(6.93);
    expect(pirateShipGroundAdvantage(5, 4.2)).toBe(13.48);        // billed as 5 lb
    expect(pirateShipGroundAdvantage(8, 1)).toBeGreaterThan(8.74);
    expect(pirateShipGroundAdvantage(2, 1)).toBeLessThan(8.74);
    expect(pirateShipGroundAdvantage(5, 71)).toBeNull();
  });
  it('compares the cheapest USPS ground rate and says how far off it is', () => {
    const b = benchmarkFor(to('GA'), { weight_lb: 2 }, [
      { carrier: 'UPS', service: 'Ground', total_charge: 12, billable_weight_lb: 2 },
      { carrier: 'USPS', service: 'USPS Ground Advantage', total_charge: 9.5, billable_weight_lb: 2 },
      { carrier: 'USPS', service: 'Priority Mail', total_charge: 11, billable_weight_lb: 2 },
    ])!;
    expect(b.zone).toBe(5);
    expect(b.pirate_ship).toBe(9.95);
    expect(b.store).toBe(9.5);
    expect(b.diff).toBe(-0.45);
    expect(b.estimated).toBe(true);
    expect(benchmarkFor({ ...to('GA'), country_alpha2: 'MX' }, { weight_lb: 2 }, [])).toBeNull();
    expect(benchmarkFor(to('GA'), { weight_lb: 2 }, [])?.store).toBeNull();
  });
  it('logs quotes and summarises the share at or under', async () => {
    await store.logBenchmark(env, { source: 'online', zone: 5, weight_lb: 2, store_price: 9.5, benchmark: 9.95 });
    await store.logBenchmark(env, { source: 'counter', zone: 5, weight_lb: 2, store_price: 10.5, benchmark: 9.95 });
    await store.logBenchmark(env, { source: 'online', zone: 5, weight_lb: 2, store_price: null, benchmark: 9.95 });
    const s = await store.benchmarkSummary(env, '2000-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z');
    expect(s).toEqual({ quotes: 2, at_or_under: 1, share: 50, avg_diff: 0.05 });
  });
});
