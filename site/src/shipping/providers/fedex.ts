// FedEx Developer Portal REST APIs. https://developer.fedex.com
// Needs FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET and FEDEX_ACCOUNT_NUMBER. FEDEX_SANDBOX=1 for the test environment.
// Not yet exercised against FedEx.
import type { Provider, Address, Parcel, Rate, Label } from '../types';
import { callJson, oauthToken, money } from '../http';
import { billableWeightLb } from '../dim';

const base = (env: Env) => (env.FEDEX_SANDBOX ? 'https://apis-sandbox.fedex.com' : 'https://apis.fedex.com');

const SERVICES: Record<string, string> = {
  FEDEX_GROUND: 'FedEx Ground', GROUND_HOME_DELIVERY: 'FedEx Home Delivery', FEDEX_EXPRESS_SAVER: 'FedEx Express Saver',
  FEDEX_2_DAY: 'FedEx 2Day', STANDARD_OVERNIGHT: 'FedEx Standard Overnight', PRIORITY_OVERNIGHT: 'FedEx Priority Overnight',
  INTERNATIONAL_ECONOMY: 'FedEx International Economy', INTERNATIONAL_PRIORITY: 'FedEx International Priority', FEDEX_INTERNATIONAL_CONNECT_PLUS: 'FedEx International Connect Plus',
};

const token = (env: Env) => oauthToken(env, 'fedex', `${base(env)}/oauth/token`, env.FEDEX_CLIENT_ID!, env.FEDEX_CLIENT_SECRET!, 'form');

const addr = (a: Address) => ({
  contact: { personName: a.contact_name, companyName: a.company_name, phoneNumber: a.contact_phone?.replace(/\D/g, '') ?? '0000000000', emailAddress: a.contact_email },
  address: { streetLines: [a.line_1, a.line_2].filter(Boolean), city: a.city, stateOrProvinceCode: a.state, postalCode: a.postal_code, countryCode: a.country_alpha2, residential: !!a.residential },
});
const pkg = (p: Parcel) => ({ weight: { units: 'LB', value: p.weight_lb }, dimensions: { length: p.length_in, width: p.width_in, height: p.height_in, units: 'IN' } });

export const fedex: Provider = {
  id: 'fedex',
  configured: (env) => !!(env.FEDEX_CLIENT_ID && env.FEDEX_CLIENT_SECRET && env.FEDEX_ACCOUNT_NUMBER),

  async rates(env, origin, destination, parcel) {
    const t = await token(env);
    const body = {
      accountNumber: { value: env.FEDEX_ACCOUNT_NUMBER },
      rateRequestControlParameters: { returnTransitTimes: true },
      requestedShipment: {
        shipper: { address: addr(origin).address }, recipient: { address: addr(destination).address },
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION', rateRequestType: ['ACCOUNT', 'LIST'], requestedPackageLineItems: [pkg(parcel)],
      },
    };
    const json = await callJson<any>('fedex', `${base(env)}/rate/v1/rates/quotes`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const list: any[] = json.output?.rateReplyDetails ?? [];
    return list.filter((r) => SERVICES[r.serviceType]).map((r) => {
      const d = r.ratedShipmentDetails?.find((x: any) => x.rateType === 'ACCOUNT') ?? r.ratedShipmentDetails?.[0];
      const days = r.commit?.transitDays?.minimumTransitTime ? null : null;
      return { id: `fedex:${r.serviceType}`, carrier: 'FedEx' as const, service: SERVICES[r.serviceType], cost: money(d?.totalNetCharge), total_charge: money(d?.totalNetCharge), currency: d?.currency ?? 'USD', min_days: days, max_days: days, billable_weight_lb: billableWeightLb('FedEx', parcel) };
    });
  },

  async buyLabel(env, origin, destination, parcel, serviceCode, opts) {
    const t = await token(env);
    const body = {
      accountNumber: { value: env.FEDEX_ACCOUNT_NUMBER },
      labelResponseOptions: 'LABEL',
      requestedShipment: {
        shipper: addr(origin), recipients: [addr(destination)],
        serviceType: serviceCode, packagingType: 'YOUR_PACKAGING', pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        shippingChargesPayment: { paymentType: 'SENDER' },
        labelSpecification: { imageType: opts.zpl ? 'ZPL' : 'PDF', labelStockType: opts.zpl ? 'STOCK_4X6' : 'PAPER_4X6' },
        requestedPackageLineItems: [{ ...pkg(parcel), itemDescription: parcel.description || 'Merchandise' }],
      },
    };
    const json = await callJson<any>('fedex', `${base(env)}/ship/v1/shipments`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const ts = json.output?.transactionShipments?.[0];
    const piece = ts?.pieceResponses?.[0];
    const doc = piece?.packageDocuments?.[0];
    const tracking = piece?.trackingNumber ?? ts?.masterTrackingNumber;
    return {
      id: `fedex:${ts?.masterTrackingNumber}`, carrier: 'FedEx', service: SERVICES[serviceCode] ?? serviceCode,
      label_url: !opts.zpl ? (doc?.url ?? (doc?.encodedLabel ? `data:application/pdf;base64,${doc.encodedLabel}` : null)) : null,
      label_zpl: opts.zpl && doc?.encodedLabel ? doc.encodedLabel : null, qr_url: null,
      tracking_number: tracking ?? null, tracking_page_url: tracking ? `https://www.fedex.com/fedextrack/?trknbr=${tracking}` : null,
      cost: money(ts?.completedShipmentDetail?.shipmentRating?.shipmentRateDetails?.[0]?.totalNetCharge ?? 0),
    };
  },

  async voidLabel(env, labelId) {
    const t = await token(env);
    await callJson('fedex', `${base(env)}/ship/v1/shipments/cancel`, { method: 'PUT', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ accountNumber: { value: env.FEDEX_ACCOUNT_NUMBER }, trackingNumber: labelId.split(':')[1] }) });
  },

  async track(env, trackingNumber) {
    const t = await token(env);
    const json = await callJson<any>('fedex', `${base(env)}/track/v1/trackingnumbers`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ includeDetailedScans: true, trackingInfo: [{ trackingNumberInfo: { trackingNumber } }] }) });
    const scans: any[] = json.output?.completeTrackResults?.[0]?.trackResults?.[0]?.scanEvents ?? [];
    return scans.map((s) => ({
      at: s.date, description: s.eventDescription ?? '', location: [s.scanLocation?.city, s.scanLocation?.stateOrProvinceCode].filter(Boolean).join(', '),
      status: ({ DL: 'delivered', OD: 'out_for_delivery', IT: 'in_transit', DP: 'in_transit', AR: 'in_transit', PU: 'in_transit', OC: 'label_created', DE: 'exception', RS: 'returned' } as any)[s.eventType] ?? 'unknown',
    }));
  },
};
