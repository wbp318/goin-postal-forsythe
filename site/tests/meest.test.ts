// Meest America (v1.71.0): rates from the agent rate sheet, labels finished at the counter until the API exists.
import { describe, it, expect } from 'vitest';
import { meest, meestPrice, meestServes, MEEST_COUNTRIES } from '../src/shipping/providers/meest';
import { getQuotes } from '../src/shipping/engine';
import table from '../src/data/meest-rates.json';

const env = {} as Env;
const origin = { contact_name: 'Store', line_1: '1800 Forsythe Ave', city: 'Monroe', state: 'LA', postal_code: '71201', country_alpha2: 'US' };
const kyiv = { contact_name: 'Olena', line_1: 'Khreshchatyk 1', city: 'Kyiv', state: '', postal_code: '01001', country_alpha2: 'UA' };
const parcel = { weight_lb: 4.3, length_in: 12, width_in: 10, height_in: 8, description: 'Clothes', value_usd: 80 };

describe('Meest rates', () => {
  it('serves the countries in the rate sheet and no others', () => {
    expect(meestServes('UA')).toBe(true);
    expect(meestServes('ua')).toBe(true);
    expect(meestServes('US')).toBe(false);
    expect(MEEST_COUNTRIES).toContain('PL');
  });
  it('prices base plus per pound on the weight rounded up, never under the minimum', () => {
    const ua = (table.countries as any).UA.air;
    expect(meestPrice('UA', 'air', 4.3)).toBe(Math.round((ua.base_usd + ua.per_lb_usd * 5) * 100) / 100);
    expect(meestPrice('UA', 'air', 0.2)).toBe(Math.round((ua.base_usd + ua.per_lb_usd * table.min_lb) * 100) / 100);
    expect(meestPrice('MD', 'economy', 3)).toBeNull(); // no sea service to Moldova
  });
  it('quotes air and economy to Ukraine and nothing to a US address', async () => {
    const ua = await meest.rates(env, origin, kyiv, parcel);
    expect(ua.map((r) => r.id).sort()).toEqual(['meest:air', 'meest:economy']);
    expect(ua.every((r) => r.carrier === 'Meest' && r.billable_weight_lb === 5)).toBe(true);
    expect(await meest.rates(env, origin, { ...kyiv, country_alpha2: 'US' }, parcel)).toEqual([]);
  });
});

describe('Meest in the engine', () => {
  it('sits beside the demo carriers on an international quote and does not switch demo mode off', async () => {
    const q = await getQuotes(env, origin, kyiv, parcel);
    expect(q.demo).toBe(true);
    expect(q.rates.some((r) => r.carrier === 'Meest')).toBe(true);
    expect(q.rates.some((r) => r.carrier === 'DHL')).toBe(true);
  });
  it('buys a counter label with no API keys: no PDF, a note for the counter', async () => {
    const l = await meest.buyLabel(env, origin, kyiv, parcel, 'air', { qr: false, zpl: false });
    expect(l.carrier).toBe('Meest');
    expect(l.label_url).toBeNull();
    expect(l.counter_note).toMatch(/counter/);
    expect(l.id.startsWith('meest:MEEST-')).toBe(true);
    await expect(meest.buyLabel(env, origin, kyiv, parcel, 'rocket', { qr: false, zpl: false })).rejects.toThrow(/Unknown Meest service/);
  });
});
