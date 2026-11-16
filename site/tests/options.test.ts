import { describe, it, expect } from 'vitest';
import { applyOptions, carriesExtras, directed, hazmatAllowed, needsDirectCarrier, optionsKey, parseOptions, pickReturnRate, returnParcel } from '../src/lib/options';
import { parseParcel } from '../src/lib/validate';
import type { Address, Rate } from '../src/shipping/types';

const rate = (id: string, carrier: Rate['carrier'], service: string): Rate => ({ id, carrier, service, cost: 5, total_charge: 6, currency: 'USD', min_days: 2, max_days: 5, billable_weight_lb: 1 });
const RATES = [
  rate('usps:USPS_GROUND_ADVANTAGE', 'USPS', 'USPS Ground Advantage'),
  rate('usps:PRIORITY_MAIL', 'USPS', 'USPS Priority Mail'),
  rate('usps:MEDIA_MAIL', 'USPS', 'USPS Media Mail'),
  rate('ups:03', 'UPS', 'UPS Ground'),
  rate('easyship:mock-usps-media', 'USPS', 'USPS Media Mail'),
];
const at = (state: string): Address => ({ contact_name: 'A', line_1: '1 Main St', city: 'X', state, postal_code: '00000', country_alpha2: 'US' });

describe('parseOptions', () => {
  it('keeps only ticked, known options', () => {
    expect(parseOptions({ signature: true, hazmat: 'on', media_mail: false, junk: true })).toEqual({ signature: true, hazmat: true });
    expect(parseOptions(undefined)).toEqual({});
  });
});

describe('applyOptions', () => {
  const ids = (o: any) => applyOptions(RATES, o).map((r) => r.id);
  it('hides Media Mail unless it is ticked', () => {
    expect(ids({})).toEqual(['usps:USPS_GROUND_ADVANTAGE', 'usps:PRIORITY_MAIL', 'ups:03']);
    expect(ids({ media_mail: true })).toContain('usps:MEDIA_MAIL');
  });
  it('offers only USPS Ground Advantage for hazardous materials, even with Media Mail ticked', () => {
    expect(ids({ hazmat: true })).toEqual(['usps:USPS_GROUND_ADVANTAGE']);
    expect(ids({ hazmat: true, media_mail: true })).toEqual(['usps:USPS_GROUND_ADVANTAGE']);
  });
});

describe('optionsKey', () => {
  it('differs when options differ, and is empty with none', () => {
    expect(optionsKey({})).toBe('');
    expect(optionsKey({ hazmat: true })).not.toBe(optionsKey({ signature: true }));
  });
});

describe('hazmatAllowed', () => {
  it('allows the lower 48 and DC', () => {
    expect(hazmatAllowed(at('LA'), at('TX'))).toBe(true);
    expect(hazmatAllowed(at('LA'), at('DC'))).toBe(true);
  });
  it('refuses Alaska, Hawaii, territories and military addresses at either end', () => {
    for (const st of ['AK', 'HI', 'PR', 'GU', 'AE']) expect(hazmatAllowed(at('LA'), at(st))).toBe(false);
    expect(hazmatAllowed(at('ak'), at('LA'))).toBe(false);
  });
});

describe('return labels', () => {
  it('reads the two modes and nothing else', () => {
    expect(parseOptions({ return_label: 'only' })).toEqual({ return_label: 'only' });
    expect(parseOptions({ return_label: 'included' })).toEqual({ return_label: 'included' });
    expect(parseOptions({ return_label: 'sometimes' })).toEqual({});
    expect(optionsKey({ return_label: 'only' })).not.toBe(optionsKey({ return_label: 'included' }));
  });
  it('"only" swaps the addresses and makes it a return; otherwise nothing moves', () => {
    expect(directed('A', 'B', { return_label: 'only' })).toEqual({ origin: 'B', destination: 'A', kind: 'return' });
    expect(directed('A', 'B', { return_label: 'included' })).toEqual({ origin: 'A', destination: 'B', kind: 'ship' });
    expect(directed('A', 'B', {})).toEqual({ origin: 'A', destination: 'B', kind: 'ship' });
  });
  it('picks the same service back, else the same carrier, else the cheapest', () => {
    const out = rate('ups:03', 'UPS', 'UPS Ground');
    const back = [rate('usps:USPS_GROUND_ADVANTAGE', 'USPS', 'USPS Ground Advantage'), { ...rate('ups:02', 'UPS', 'UPS 2nd Day Air'), total_charge: 20 }, { ...rate('ups:03', 'UPS', 'UPS Ground'), total_charge: 11 }];
    expect(pickReturnRate(out, back)?.id).toBe('ups:03');
    expect(pickReturnRate(out, back.filter((r) => r.id !== 'ups:03'))?.id).toBe('ups:02');
    expect(pickReturnRate(rate('fedex:X', 'FedEx', 'FedEx Ground'), back)?.carrier).toBeDefined();
    expect(pickReturnRate(out, [])).toBeUndefined();
  });
  it('the return parcel drops signature, insurance and the return choice, and keeps hazmat', () => {
    const p = returnParcel({ weight_lb: 3, options: { signature: true, hazmat: true, return_label: 'included' as const }, insured_usd: 450 } as any);
    expect(p.options).toEqual({ hazmat: true });
    expect((p as any).insured_usd).toBeUndefined();
  });
});

describe('extras only through adapters that put them on the label', () => {
  const mixed = [
    rate('usps:USPS_GROUND_ADVANTAGE', 'USPS', 'USPS Ground Advantage'),
    rate('ups:03', 'UPS', 'UPS Ground'),
    rate('fedex:FEDEX_GROUND', 'FedEx', 'FedEx Ground'),
    rate('dhl:N', 'DHL', 'DHL Express Domestic'),
    rate('easyship:es-ups', 'UPS', 'UPS Ground'),
  ];
  const ids = (p: any) => carriesExtras(mixed, p).map((r) => r.id);
  it('signature, hazmat and carrier packaging need a direct USPS, UPS or FedEx adapter', () => {
    expect(needsDirectCarrier({ options: { signature: true } })).toBe(true);
    expect(needsDirectCarrier({ options: { hazmat: true } })).toBe(true);
    expect(needsDirectCarrier({ packaging: 'usps-fr-small-box' })).toBe(true);
    expect(needsDirectCarrier({ options: { media_mail: true, irregular: true }, packaging: 'tube' })).toBe(false);
    expect(needsDirectCarrier({})).toBe(false);
  });
  it('drops Easyship and DHL rates only when one of them is chosen', () => {
    expect(ids({})).toHaveLength(5);
    expect(ids({ options: { signature: true } })).toEqual(['usps:USPS_GROUND_ADVANTAGE', 'ups:03', 'fedex:FEDEX_GROUND']);
    expect(ids({ packaging: 'ups-express-pak' })).toEqual(['usps:USPS_GROUND_ADVANTAGE', 'ups:03', 'fedex:FEDEX_GROUND']);
  });
});

describe('options are read only on the ship page routes', () => {
  const base = { weight_lb: 2, length_in: 10, width_in: 8, height_in: 4, options: { signature: true, hazmat: true, return_label: 'included' } };
  it('the API, x402, queue and batch paths ignore options sent with the parcel', () => {
    expect(parseParcel(base).options).toEqual({});
  });
  it('the ship page routes keep them', () => {
    expect(parseParcel(base, { options: true }).options).toEqual({ signature: true, hazmat: true, return_label: 'included' });
  });
  it('a tube is still priced as irregular on every path (it comes from the packaging)', () => {
    expect(parseParcel({ ...base, packaging: 'tube' }).options).toEqual({ irregular: true });
  });
});
