// Signature, hazardous materials and carrier packaging reach the carrier only through the direct USPS, UPS and
// FedEx adapters, so Easyship (insurance only) and DHL rates are not offered for them.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getQuotes } from '../src/shipping/engine';
import { NO_CARRIER_FOR_EXTRAS } from '../src/lib/options';

const at = (city: string, state: string, postal_code: string) => ({ contact_name: 'T', line_1: '1 Main St', city, state, postal_code, country_alpha2: 'US' });
const from = at('Monroe', 'LA', '71201'), to = at('Dallas', 'TX', '75201');
const parcel = (extra: any = {}) => ({ weight_lb: 2, length_in: 10, width_in: 8, height_in: 4, description: '', value_usd: 1, ...extra });
const svc = (id: string, umbrella: string, name: string, total_charge: number) => ({ courier_service: { id, umbrella_name: umbrella, name }, total_charge, currency: 'USD', min_delivery_time: 2, max_delivery_time: 5 });
const live = { rates: [svc('es-usps-ga', 'USPS', 'USPS Ground Advantage', 8), svc('es-ups-gnd', 'UPS', 'UPS Ground', 11), svc('es-dhl', 'DHL', 'DHL Parcel Ground', 10)] };

afterEach(() => { vi.unstubAllGlobals(); });

describe('with Easyship as the only live source', () => {
  const env = { EASYSHIP_TOKEN: 'test-token' } as any;
  const stub = () => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(live), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  it('plain parcels are quoted as before', async () => {
    stub();
    const q = await getQuotes(env, from, to, parcel());
    expect(q.demo).toBe(false);
    expect(q.rates.length).toBe(3);
  });
  it('signature, hazmat or carrier packaging finds nothing and says to bring it to the counter', async () => {
    stub();
    await expect(getQuotes(env, from, to, parcel({ options: { signature: true } }))).rejects.toThrow(NO_CARRIER_FOR_EXTRAS);
    await expect(getQuotes(env, from, to, parcel({ options: { hazmat: true } }))).rejects.toThrow(NO_CARRIER_FOR_EXTRAS);
  });
  it('carrier packaging too, once a service of that carrier would fit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ rates: [svc('es-ups-nda', 'UPS', 'UPS Next Day Air', 30)] }), { status: 200 })));
    await expect(getQuotes(env, from, to, parcel({ packaging: 'ups-express-pak' }))).rejects.toThrow(NO_CARRIER_FOR_EXTRAS);
  });
  it('insurance alone still goes through Easyship', async () => {
    stub();
    const q = await getQuotes(env, from, to, parcel({ insured_usd: 300 }));
    expect(q.rates.length).toBe(3);
  });
});

describe('demo mode', () => {
  it('keeps its demo rates for signature, so the ship page can be tried without carrier accounts', async () => {
    const q = await getQuotes({} as any, from, to, parcel({ options: { signature: true } }));
    expect(q.demo).toBe(true);
    expect(q.rates.length).toBeGreaterThan(0);
  });
});
