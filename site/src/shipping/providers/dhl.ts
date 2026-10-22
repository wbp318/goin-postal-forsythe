// DHL Express MyDHL API. https://developer.dhl.com/api-reference/dhl-express-mydhl-api
// Needs DHL_API_KEY, DHL_API_SECRET and DHL_ACCOUNT_NUMBER. DHL_SANDBOX=1 for the test environment.
// Not yet exercised against DHL. DHL approves API access per account and is the slowest of the four.
import type { Provider, Address, Parcel, Rate, Label } from '../types';
import { callJson, money } from '../http';
import { billableWeightLb } from '../dim';

const base = (env: Env) => (env.DHL_SANDBOX ? 'https://express.api.dhl.com/mydhlapi/test' : 'https://express.api.dhl.com/mydhlapi');
const auth = (env: Env) => 'Basic ' + btoa(`${env.DHL_API_KEY}:${env.DHL_API_SECRET}`);

const SERVICES: Record<string, string> = { P: 'DHL Express Worldwide', N: 'DHL Express Domestic', T: 'DHL Express 12:00', K: 'DHL Express 9:00', H: 'DHL Express Economy Select' };

const addr = (a: Address) => ({
  postalAddress: { postalCode: a.postal_code, cityName: a.city, countryCode: a.country_alpha2, provinceCode: a.state, addressLine1: a.line_1, addressLine2: a.line_2 },
  contactInformation: { phone: a.contact_phone ?? '0000000000', companyName: a.company_name ?? a.contact_name, fullName: a.contact_name, email: a.contact_email },
});
const kg = (lb: number) => Math.round(lb * 0.4536 * 1000) / 1000;
const cm = (inch: number) => Math.round(inch * 2.54 * 10) / 10;

export const dhl: Provider = {
  id: 'dhl',
  configured: (env) => !!(env.DHL_API_KEY && env.DHL_API_SECRET && env.DHL_ACCOUNT_NUMBER),

  async rates(env, origin, destination, parcel) {
    const q = new URLSearchParams({
      accountNumber: env.DHL_ACCOUNT_NUMBER!, originCountryCode: origin.country_alpha2, originPostalCode: origin.postal_code, originCityName: origin.city,
      destinationCountryCode: destination.country_alpha2, destinationPostalCode: destination.postal_code, destinationCityName: destination.city,
      weight: String(kg(parcel.weight_lb)), length: String(cm(parcel.length_in)), width: String(cm(parcel.width_in)), height: String(cm(parcel.height_in)),
      plannedShippingDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), isCustomsDeclarable: String(destination.country_alpha2 !== 'US'), unitOfMeasurement: 'metric', nextBusinessDay: 'true',
    });
    const json = await callJson<any>('dhl', `${base(env)}/rates?${q}`, { headers: { Authorization: auth(env) } });
    const list: any[] = json.products ?? [];
    return list.filter((p) => SERVICES[p.productCode]).map((p) => {
      const price = p.totalPrice?.find((x: any) => x.currencyType === 'BILLC') ?? p.totalPrice?.[0];
      const days = p.deliveryCapabilities?.totalTransitDays;
      return { id: `dhl:${p.productCode}`, carrier: 'DHL' as const, service: SERVICES[p.productCode], cost: money(price?.price), total_charge: money(price?.price), currency: price?.priceCurrency ?? 'USD', min_days: days ?? null, max_days: days ?? null, billable_weight_lb: billableWeightLb('DHL', parcel) };
    });
  },

  async buyLabel(env, origin, destination, parcel, serviceCode, opts) {
    const international = destination.country_alpha2 !== origin.country_alpha2;
    const body: any = {
      plannedShippingDateAndTime: new Date(Date.now() + 86400000).toISOString().replace(/\.\d+Z$/, ' GMT+00:00').replace('T', 'T'),
      pickup: { isRequested: false },
      productCode: serviceCode,
      accounts: [{ typeCode: 'shipper', number: env.DHL_ACCOUNT_NUMBER }],
      outputImageProperties: { encodingFormat: opts.zpl ? 'zpl' : 'pdf', imageOptions: [{ typeCode: 'label', templateName: 'ECOM26_84_A4_001' }] },
      customerDetails: { shipperDetails: addr(origin), receiverDetails: addr(destination) },
      content: {
        packages: [{ weight: kg(parcel.weight_lb), dimensions: { length: cm(parcel.length_in), width: cm(parcel.width_in), height: cm(parcel.height_in) } }],
        isCustomsDeclarable: international, declaredValue: parcel.value_usd, declaredValueCurrency: 'USD', description: parcel.description || 'Merchandise', incoterm: 'DAP', unitOfMeasurement: 'metric',
        ...(international ? { exportDeclaration: { lineItems: [{ number: 1, description: parcel.description || 'Merchandise', price: parcel.value_usd, quantity: { value: 1, unitOfMeasurement: 'PCS' }, manufacturerCountry: origin.country_alpha2, weight: { netValue: kg(parcel.weight_lb), grossValue: kg(parcel.weight_lb) } }], invoice: { number: `GP-${Date.now()}`, date: new Date().toISOString().slice(0, 10) } } } : {}),
      },
    };
    const json = await callJson<any>('dhl', `${base(env)}/shipments`, { method: 'POST', headers: { Authorization: auth(env), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const doc = (json.documents ?? []).find((d: any) => d.typeCode === 'label') ?? json.documents?.[0];
    const tracking = json.shipmentTrackingNumber;
    return {
      id: `dhl:${tracking}`, carrier: 'DHL', service: SERVICES[serviceCode] ?? serviceCode,
      label_url: !opts.zpl && doc?.content ? `data:application/pdf;base64,${doc.content}` : null, label_zpl: opts.zpl && doc?.content ? doc.content : null, qr_url: null,
      tracking_number: tracking ?? null, tracking_page_url: tracking ? `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${tracking}` : null,
      cost: money(json.shipmentCharges?.[0]?.price ?? 0),
      customs_url: (json.documents ?? []).find((d: any) => d.typeCode === 'invoice')?.content ? 'data:application/pdf;base64,' + json.documents.find((d: any) => d.typeCode === 'invoice').content : null,
    };
  },

  async track(env, trackingNumber) {
    const json = await callJson<any>('dhl', `${base(env)}/shipments/${trackingNumber}/tracking`, { headers: { Authorization: auth(env) } });
    const events: any[] = json.shipments?.[0]?.events ?? [];
    return events.map((e) => ({
      at: `${e.date}T${e.time}`, description: e.description ?? '', location: e.serviceArea?.[0]?.description,
      status: ({ OK: 'delivered', WC: 'out_for_delivery', PU: 'in_transit', AF: 'in_transit', DF: 'in_transit', PL: 'in_transit', RT: 'returned', SA: 'label_created' } as any)[e.typeCode] ?? 'unknown',
    }));
  },
};
