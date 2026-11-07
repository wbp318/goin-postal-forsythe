// PeterShip is domestic only (Nov 7, 2026): every address must be in the US, and no Meest or
// international rate is ever quoted. DHL stays, for US-to-US service only.
import { describe, it, expect } from 'vitest';
import { parseAddress, US_ONLY } from '../src/lib/validate';
import { getQuotes } from '../src/shipping/engine';

const base = { contact_name: 'Test', line_1: '1800 Forsythe Ave', city: 'Monroe', state: 'LA', postal_code: '71201' };

describe('domestic only', () => {
  it('refuses an address outside the United States', () => {
    expect(() => parseAddress({ ...base, country_alpha2: 'CA', state: 'ON', postal_code: 'M5V 2T6' })).toThrow(US_ONLY);
    expect(() => parseAddress({ ...base, country_alpha2: 'UA' })).toThrow(/United States only/);
  });

  it('takes a US address, and treats a missing country as the US', () => {
    expect(parseAddress({ ...base, country_alpha2: 'us' }).country_alpha2).toBe('US');
    expect(parseAddress(base).country_alpha2).toBe('US');
  });

  it('takes Puerto Rico and military addresses as US addresses with their codes', () => {
    expect(parseAddress({ ...base, city: 'San Juan', state: 'PR', postal_code: '00901', country_alpha2: 'US' }).state).toBe('PR');
    expect(parseAddress({ ...base, city: 'APO', state: 'AE', postal_code: '09012', country_alpha2: 'US' }).state).toBe('AE');
  });

  it('quotes no Meest and no international DHL service', async () => {
    const origin = parseAddress(base);
    const to = parseAddress({ ...base, city: 'Dallas', state: 'TX', postal_code: '75201' });
    const { rates } = await getQuotes({} as Env, origin, to, { weight_lb: 2, length_in: 10, width_in: 8, height_in: 4, description: 'Shirt', value_usd: 20 });
    expect(rates.length).toBeGreaterThan(0);
    expect(rates.some((r) => (r.carrier as string) === 'Meest')).toBe(false);
    expect(rates.some((r) => /Worldwide|International/i.test(r.service))).toBe(false);
  });
});
