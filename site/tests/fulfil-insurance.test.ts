// The insurance a customer paid for must reach the carrier on the label (Peter, Nov 14 2026).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const bought: any[] = [];
vi.mock('../src/shipping/engine', () => ({
  buyLabel: vi.fn(async (_env: any, _o: any, _d: any, parcel: any) => {
    bought.push(parcel);
    return { id: 'usps:TEST', carrier: 'USPS', service: 'USPS Ground Advantage', label_url: null, label_zpl: null, qr_url: null, tracking_number: 'TEST', tracking_page_url: null, cost: 5 };
  }),
}));

import { fulfil } from '../src/lib/fulfil';

const addr = { contact_name: 'A B', line_1: '1 Main St', city: 'Monroe', state: 'LA', postal_code: '71201', country_alpha2: 'US' };
const order = (extra: any = {}): any => ({
  id: 'GP-TEST' + Math.random().toString(36).slice(2, 6).toUpperCase(), status: 'awaiting_payment', created_at: new Date().toISOString(), email: 'a@example.com',
  origin: addr, destination: { ...addr, city: 'Dallas', state: 'TX', postal_code: '75201' },
  parcel: { weight_lb: 3, length_in: 12, width_in: 10, height_in: 6, description: 'Shoes', value_usd: 450 },
  rate: { id: 'usps:USPS_GROUND_ADVANTAGE', carrier: 'USPS', service: 'USPS Ground Advantage', cost: 5, total_charge: 9.65, currency: 'USD', min_days: 2, max_days: 5, billable_weight_lb: 3 },
  international: false, total: 9.65, ...extra,
});

describe('fulfil: insurance goes on the label', () => {
  beforeEach(() => { bought.length = 0; });
  it('passes the insured amount when insurance was bought', async () => {
    await fulfil({} as any, order({ insurance: { declared_usd: 450, fee: 5 } }), 'mock');
    expect(bought[0].insured_usd).toBe(450);
  });
  it('sends no insurance when none was bought, even with a value on the parcel', async () => {
    await fulfil({} as any, order(), 'mock');
    expect(bought[0].insured_usd).toBeUndefined();
  });
});
