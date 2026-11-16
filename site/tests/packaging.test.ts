import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { PACKAGING, applyPackaging, packagingById, uspsRateIndicator, upsPackagingCode, fedexPackagingType } from '../src/lib/packaging';
import { parseParcel } from '../src/lib/validate';
import type { Rate } from '../src/shipping/types';

const rate = (id: string, carrier: Rate['carrier'], service: string): Rate => ({ id, carrier, service, cost: 5, total_charge: 6, currency: 'USD', min_days: 2, max_days: 5, billable_weight_lb: 1 });
const RATES = [
  rate('usps:USPS_GROUND_ADVANTAGE', 'USPS', 'USPS Ground Advantage'),
  rate('usps:PRIORITY_MAIL', 'USPS', 'USPS Priority Mail'),
  rate('usps:PRIORITY_MAIL_EXPRESS', 'USPS', 'USPS Priority Mail Express'),
  rate('ups:03', 'UPS', 'UPS Ground'),
  rate('ups:02', 'UPS', 'UPS 2nd Day Air'),
  rate('fedex:GROUND_HOME_DELIVERY', 'FedEx', 'FedEx Home Delivery'),
  rate('fedex:FEDEX_2_DAY', 'FedEx', 'FedEx 2Day'),
  rate('dhl:G', 'DHL', 'DHL Parcel Ground'),
];
const ids = (pkg: string) => applyPackaging(RATES, pkg).map((r) => r.id);

describe('packaging catalog', () => {
  it('has unique ids and a picture file for every entry', () => {
    expect(new Set(PACKAGING.map((p) => p.id)).size).toBe(PACKAGING.length);
    for (const p of PACKAGING) expect(existsSync(new URL(`../public${p.img}`, import.meta.url)), p.img).toBe(true);
  });
  it('gives every carrier packaging a size, a service rule and a carrier code', () => {
    for (const p of PACKAGING.filter((x) => x.group !== 'own')) {
      expect(p.dims, p.id).toBeDefined();
      expect(p.services, p.id).toBeDefined();
      expect(p.usps ?? p.ups ?? p.fedex, p.id).toBeDefined();
    }
  });
});

describe('which services may carry the packaging', () => {
  it('own packaging changes nothing', () => {
    expect(ids('box')).toHaveLength(RATES.length);
    expect(ids('soft')).toHaveLength(RATES.length);
  });
  it('USPS flat rate goes by Priority Mail only; Express envelopes by Priority Mail Express only', () => {
    expect(ids('usps-fr-medium-box')).toEqual(['usps:PRIORITY_MAIL']);
    expect(ids('usps-express-envelope')).toEqual(['usps:PRIORITY_MAIL_EXPRESS']);
  });
  it('UPS and FedEx packaging go by that carrier\'s express services only', () => {
    expect(ids('ups-express-pak')).toEqual(['ups:02']);
    expect(ids('fedex-small-box')).toEqual(['fedex:FEDEX_2_DAY']);
  });
});

describe('carrier codes', () => {
  it('defaults to "your own packaging"', () => {
    expect(uspsRateIndicator(undefined)).toBe('SP');
    expect(upsPackagingCode('box')).toBe('02');
    expect(fedexPackagingType(undefined)).toBe('YOUR_PACKAGING');
  });
  it('uses each carrier\'s own code for its packaging', () => {
    expect(uspsRateIndicator('usps-fr-small-box')).toBe('FS');
    expect(upsPackagingCode('ups-express-pak')).toBe('04');
    expect(fedexPackagingType('fedex-pak')).toBe('FEDEX_PAK');
  });
});

describe('parseParcel with packaging', () => {
  const base = { weight_lb: 3, length_in: 30, width_in: 20, height_in: 10, description: 'x' };
  it('takes the carrier packaging\'s own size', () => {
    const p = parseParcel({ ...base, packaging: 'usps-fr-small-box' });
    expect([p.length_in, p.width_in, p.height_in]).toEqual(packagingById('usps-fr-small-box')!.dims);
    expect(p.packaging).toBe('usps-fr-small-box');
  });
  it('marks a tube or irregular package as irregular', () => {
    expect(parseParcel({ ...base, packaging: 'tube' }).options?.irregular).toBe(true);
  });
  it('ignores unknown packaging and keeps the typed size', () => {
    const p = parseParcel({ ...base, packaging: 'mystery' });
    expect(p.packaging).toBeUndefined();
    expect(p.length_in).toBe(30);
  });
  it('refuses more than a USPS flat rate packaging may hold', () => {
    expect(() => parseParcel({ ...base, weight_lb: 80, packaging: 'usps-fr-large-box' })).toThrow(/70 lb/);
  });
});
