// Shared shapes for the shipping client. Every carrier adapter maps to and from these,
// so the rating engine, the pages and the counter never see a carrier's own format.

export type CarrierId = 'usps' | 'ups' | 'fedex' | 'dhl' | 'easyship';

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
  residential?: boolean;
}

export interface Parcel {
  weight_lb: number;
  length_in: number;
  width_in: number;
  height_in: number;
  description: string;
  value_usd: number;
}

/** One service a customer can pick. `id` is "<carrier>:<service code>" and is the only thing the browser sends back. */
export interface Rate {
  id: string;
  carrier: 'USPS' | 'UPS' | 'FedEx' | 'DHL';
  service: string;
  cost: number;           // what the carrier charges the store
  total_charge: number;   // what the customer pays, after retail rules
  currency: string;
  min_days: number | null;
  max_days: number | null;
  billable_weight_lb: number;
}

export interface Label {
  id: string;             // "<carrier>:<carrier shipment id>"
  carrier: Rate['carrier'];
  service: string;
  label_url: string | null;      // PDF for home printing
  label_zpl: string | null;      // ZPL for the counter's thermal printer, base64
  qr_url: string | null;         // carrier QR drop-off code where offered
  tracking_number: string | null;
  tracking_page_url: string | null;
  cost: number;
  customs_url?: string | null;
}

export interface TrackingEvent {
  at: string;
  status: 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'returned' | 'unknown';
  description: string;
  location?: string;
}

export interface Provider {
  id: CarrierId;
  /** True when the credentials this adapter needs are present. */
  configured(env: Env): boolean;
  rates(env: Env, origin: Address, destination: Address, parcel: Parcel): Promise<Rate[]>;
  buyLabel(env: Env, origin: Address, destination: Address, parcel: Parcel, serviceCode: string, opts: { qr: boolean; zpl: boolean }): Promise<Label>;
  voidLabel?(env: Env, labelId: string): Promise<void>;
  track?(env: Env, trackingNumber: string): Promise<TrackingEvent[]>;
}

export class CarrierError extends Error {
  constructor(public carrier: CarrierId, message: string, public status?: number) {
    super(`${carrier}: ${message}`);
  }
}
