// UPS Developer Portal REST APIs. https://developer.ups.com
// Needs UPS_CLIENT_ID, UPS_CLIENT_SECRET (app linked to the store's account) and UPS_ACCOUNT_NUMBER.
// UPS_SANDBOX=1 points at the CIE test environment. Not yet exercised against UPS.
import type { Provider, Address, Parcel, Rate, Label } from '../types';
import { callJson, oauthToken, money } from '../http';
import { billableWeightLb } from '../dim';

const base = (env: Env) => (env.UPS_SANDBOX ? 'https://wwwcie.ups.com' : 'https://onlinetools.ups.com');
const V = 'v2403';

const SERVICES: Record<string, string> = {
  '03': 'UPS Ground', '12': 'UPS 3 Day Select', '02': 'UPS 2nd Day Air', '13': 'UPS Next Day Air Saver', '01': 'UPS Next Day Air',
  '11': 'UPS Standard', '08': 'UPS Worldwide Expedited', '07': 'UPS Worldwide Express', '65': 'UPS Worldwide Saver',
};

const token = (env: Env) => oauthToken(env, 'ups', `${base(env)}/security/v1/oauth/token`, env.UPS_CLIENT_ID!, env.UPS_CLIENT_SECRET!, 'basic-form');

const addr = (a: Address) => ({
  Name: a.company_name ?? a.contact_name, AttentionName: a.contact_name, Phone: a.contact_phone ? { Number: a.contact_phone.replace(/\D/g, '') } : undefined,
  Address: { AddressLine: [a.line_1, a.line_2].filter(Boolean), City: a.city, StateProvinceCode: a.state, PostalCode: a.postal_code, CountryCode: a.country_alpha2, ResidentialAddressIndicator: a.residential ? '' : undefined },
});
const pkg = (p: Parcel) => ({
  PackagingType: { Code: '02' },
  Dimensions: { UnitOfMeasurement: { Code: 'IN' }, Length: String(p.length_in), Width: String(p.width_in), Height: String(p.height_in) },
  PackageWeight: { UnitOfMeasurement: { Code: 'LBS' }, Weight: String(p.weight_lb) },
});

export const ups: Provider = {
  id: 'ups',
  configured: (env) => !!(env.UPS_CLIENT_ID && env.UPS_CLIENT_SECRET && env.UPS_ACCOUNT_NUMBER),

  async rates(env, origin, destination, parcel) {
    const t = await token(env);
    const body = { RateRequest: {
      Request: { RequestOption: 'Shoptimeintransit' },
      Shipment: {
        Shipper: { ...addr(origin), ShipperNumber: env.UPS_ACCOUNT_NUMBER },
        ShipTo: addr(destination), ShipFrom: addr(origin),
        PaymentDetails: { ShipmentCharge: [{ Type: '01', BillShipper: { AccountNumber: env.UPS_ACCOUNT_NUMBER } }] },
        Package: [pkg(parcel)],
        ShipmentRatingOptions: { NegotiatedRatesIndicator: '' },
      },
    } };
    const json = await callJson<any>('ups', `${base(env)}/api/rating/${V}/Shop?additionalinfo=timeintransit`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const list: any[] = json.RateResponse?.RatedShipment ?? [];
    return list.filter((r) => SERVICES[r.Service?.Code]).map((r) => {
      const price = r.NegotiatedRateCharges?.TotalCharge?.MonetaryValue ?? r.TotalCharges?.MonetaryValue;
      const days = r.TimeInTransit?.ServiceSummary?.EstimatedArrival?.BusinessDaysInTransit;
      return { id: `ups:${r.Service.Code}`, carrier: 'UPS' as const, service: SERVICES[r.Service.Code], cost: money(price), total_charge: money(price), currency: 'USD', min_days: days ? Number(days) : null, max_days: days ? Number(days) : null, billable_weight_lb: billableWeightLb('UPS', parcel) };
    });
  },

  async buyLabel(env, origin, destination, parcel, serviceCode, opts) {
    const t = await token(env);
    const body = { ShipmentRequest: {
      Request: { RequestOption: 'nonvalidate' },
      Shipment: {
        Description: parcel.description || 'Merchandise',
        Shipper: { ...addr(origin), ShipperNumber: env.UPS_ACCOUNT_NUMBER },
        ShipTo: addr(destination), ShipFrom: addr(origin),
        PaymentInformation: { ShipmentCharge: { Type: '01', BillShipper: { AccountNumber: env.UPS_ACCOUNT_NUMBER } } },
        Service: { Code: serviceCode },
        Package: { ...pkg(parcel), Description: parcel.description || 'Merchandise' },
        ShipmentRatingOptions: { NegotiatedRatesIndicator: '' },
      },
      LabelSpecification: { LabelImageFormat: { Code: opts.zpl ? 'ZPL' : 'PDF' }, LabelStockSize: { Height: '6', Width: '4' } },
    } };
    const json = await callJson<any>('ups', `${base(env)}/api/shipments/${V}/ship`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const res = json.ShipmentResponse?.ShipmentResults;
    const p = res?.PackageResults?.[0] ?? res?.PackageResults;
    const image: string | undefined = p?.ShippingLabel?.GraphicImage;
    const tracking = p?.TrackingNumber ?? res?.ShipmentIdentificationNumber;
    return {
      id: `ups:${res?.ShipmentIdentificationNumber}`, carrier: 'UPS', service: SERVICES[serviceCode] ?? serviceCode,
      label_url: !opts.zpl && image ? `data:application/pdf;base64,${image}` : null, label_zpl: opts.zpl && image ? image : null, qr_url: null,
      tracking_number: tracking ?? null, tracking_page_url: tracking ? `https://www.ups.com/track?tracknum=${tracking}` : null,
      cost: money(res?.NegotiatedRateCharges?.TotalCharge?.MonetaryValue ?? res?.ShipmentCharges?.TotalCharges?.MonetaryValue ?? 0),
    };
  },

  async voidLabel(env, labelId) {
    const t = await token(env);
    await callJson('ups', `${base(env)}/api/shipments/v1/void/cancel/${labelId.split(':')[1]}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } });
  },

  async track(env, trackingNumber) {
    const t = await token(env);
    const json = await callJson<any>('ups', `${base(env)}/api/track/v1/details/${trackingNumber}`, { headers: { Authorization: `Bearer ${t}`, transId: crypto.randomUUID(), transactionSrc: 'goinpostal' } });
    const acts: any[] = json.trackResponse?.shipment?.[0]?.package?.[0]?.activity ?? [];
    return acts.map((a) => ({
      at: `${a.date}T${a.time}`, description: a.status?.description ?? '', location: [a.location?.address?.city, a.location?.address?.stateProvince].filter(Boolean).join(', '),
      status: ({ D: 'delivered', I: 'in_transit', M: 'label_created', X: 'exception', P: 'in_transit', O: 'out_for_delivery', RS: 'returned' } as any)[a.status?.type] ?? 'unknown',
    }));
  },
};
