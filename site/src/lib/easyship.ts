// Easyship public API, version 2024-09. https://developers.easyship.com/reference
// The store's own Easyship account is used, so its linked USPS, UPS, FedEx and DHL
// accounts and negotiated rates apply. Without a token every call returns mock data.

const BASE = 'https://public-api.easyship.com/2024-09';
const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL'];

export interface Address {
  contact_name: string;
  company_name?: string;
  contact_phone?: string;
  contact_email?: string;
  line_1: string;
  line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_alpha2: string;
}

export interface Parcel {
  weight_lb: number;
  length_in: number;
  width_in: number;
  height_in: number;
  description: string;
  value_usd: number;
}

export interface Rate {
  courier_service_id: string;
  carrier: string;        // umbrella name: USPS, UPS, FedEx, DHL
  service: string;        // e.g. "USPS Priority Mail"
  total_charge: number;
  currency: string;
  min_days: number | null;
  max_days: number | null;
}

export interface Label {
  easyship_shipment_id: string;
  label_state: string;
  label_url: string | null;
  qr_url: string | null;
  tracking_number: string | null;
  tracking_page_url: string | null;
}

function body(origin: Address, destination: Address, parcel: Parcel) {
  return {
    origin_address: origin,
    destination_address: destination,
    incoterms: 'DDU',
    parcels: [{
      total_actual_weight: parcel.weight_lb,
      box: { length: parcel.length_in, width: parcel.width_in, height: parcel.height_in },
      items: [{
        description: parcel.description || 'Merchandise',
        category: 'home_decor',
        quantity: 1,
        actual_weight: parcel.weight_lb,
        dimensions: { length: parcel.length_in, width: parcel.width_in, height: parcel.height_in },
        declared_currency: 'USD',
        declared_customs_value: parcel.value_usd || 1,
        origin_country_alpha2: origin.country_alpha2,
      }],
    }],
    shipping_settings: { units: { weight: 'lb', dimensions: 'in' } },
  };
}

async function call(token: string, path: string, payload: unknown) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json: any = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.meta?.errors?.join('; ') ?? res.statusText;
    throw new Error(`Easyship ${path} ${res.status}: ${msg}`);
  }
  return json;
}

export async function getRates(token: string | undefined, origin: Address, destination: Address, parcel: Parcel): Promise<Rate[]> {
  if (!token) return mockRates(destination.country_alpha2 !== 'US');
  const json = await call(token, '/rates', body(origin, destination, parcel));
  return (json.rates as any[])
    .map((r) => ({
      courier_service_id: r.courier_service.id,
      carrier: r.courier_service.umbrella_name,
      service: r.courier_service.name,
      total_charge: r.total_charge,
      currency: r.currency,
      min_days: r.min_delivery_time ?? null,
      max_days: r.max_delivery_time ?? null,
    }))
    .filter((r) => CARRIERS.some((c) => r.carrier?.toLowerCase().startsWith(c.toLowerCase())))
    .sort((a, b) => a.total_charge - b.total_charge);
}

/** Creates the shipment and buys the label in one call. `qr` asks the carrier for a QR drop-off code where supported. */
export async function buyLabel(token: string | undefined, origin: Address, destination: Address, parcel: Parcel, courier_service_id: string, qr: boolean): Promise<Label> {
  if (!token) return mockLabel();
  const payload = {
    ...body(origin, destination, parcel),
    courier_settings: { courier_service_id },
    shipping_settings: {
      units: { weight: 'lb', dimensions: 'in' },
      buy_label: true,
      buy_label_synchronous: true,
      printing_options: { format: 'pdf', label: '4x6', packing_slip: '4x6', commercial_invoice: 'A4' },
      additional_services: { qr_code: qr ? 'optional' : 'none' },
    },
  };
  const json = await call(token, '/shipments', payload);
  const s = json.shipment;
  const docs: any[] = s.shipping_documents ?? [];
  const find = (cat: string) => docs.find((d) => d.category === cat)?.url ?? null;
  return {
    easyship_shipment_id: s.easyship_shipment_id,
    label_state: s.label_state,
    label_url: find('label'),
    qr_url: find('qr_code'),
    tracking_number: s.trackings?.[0]?.tracking_number ?? null,
    tracking_page_url: s.tracking_page_url ?? null,
  };
}

// ---- mock mode -------------------------------------------------------------

function mockRates(international: boolean): Rate[] {
  const base = international ? 48 : 9;
  return [
    { courier_service_id: 'mock-usps-ground', carrier: 'USPS', service: 'USPS Ground Advantage', total_charge: base + 0.65, currency: 'USD', min_days: 2, max_days: 5 },
    { courier_service_id: 'mock-ups-ground', carrier: 'UPS', service: 'UPS Ground', total_charge: base + 3.1, currency: 'USD', min_days: 1, max_days: 5 },
    { courier_service_id: 'mock-fedex-home', carrier: 'FedEx', service: 'FedEx Home Delivery', total_charge: base + 3.4, currency: 'USD', min_days: 1, max_days: 5 },
    { courier_service_id: 'mock-usps-priority', carrier: 'USPS', service: 'USPS Priority Mail', total_charge: base + 4.2, currency: 'USD', min_days: 1, max_days: 3 },
    { courier_service_id: 'mock-dhl-express', carrier: 'DHL', service: 'DHL Express Worldwide', total_charge: base + 31, currency: 'USD', min_days: 1, max_days: 3 },
  ];
}

function mockLabel(): Label {
  return {
    easyship_shipment_id: 'ESMOCK' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    label_state: 'generated',
    label_url: '/demo-label.html',
    qr_url: null,
    tracking_number: '9400 1000 0000 0000 0000 00',
    tracking_page_url: null,
  };
}
