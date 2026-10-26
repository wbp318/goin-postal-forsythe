// Easyship as one adapter among five: the single-call fallback that covers all four carriers.
// Stays switched on until the direct adapters have passed the parity test, then becomes the fallback.
import type { Provider, Rate, TrackingEvent } from '../types';
import { getRates, buyLabel as esBuy } from '../../lib/easyship';
import { billableWeightLb } from '../dim';

const carrierOf = (umbrella: string): Rate['carrier'] => {
  const u = umbrella.toLowerCase();
  return u.startsWith('usps') ? 'USPS' : u.startsWith('ups') ? 'UPS' : u.startsWith('fedex') ? 'FedEx' : 'DHL';
};

export const easyship: Provider = {
  id: 'easyship',
  // Also "configured" when nothing else is, so mock mode keeps working with no keys at all.
  configured: () => true,

  async rates(env, origin, destination, parcel) {
    const list = await getRates(env.EASYSHIP_TOKEN, origin, destination, parcel);
    return list.map((r) => ({
      id: `easyship:${r.courier_service_id}`, carrier: carrierOf(r.carrier), service: r.service,
      cost: r.total_charge, total_charge: r.total_charge, currency: r.currency, min_days: r.min_days, max_days: r.max_days,
      billable_weight_lb: billableWeightLb(carrierOf(r.carrier), parcel),
    }));
  },

  async buyLabel(env, origin, destination, parcel, serviceCode, opts) {
    const l = await esBuy(env.EASYSHIP_TOKEN, origin, destination, parcel, serviceCode, opts.qr);
    return {
      id: `easyship:${l.easyship_shipment_id}`, carrier: 'USPS', service: '', label_url: l.label_url, label_zpl: null, qr_url: l.qr_url,
      tracking_number: l.tracking_number, tracking_page_url: l.tracking_page_url, cost: 0,
    };
  },

  // Easyship's tracking lives on its own page (tracking_page_url). With no token we are in mock mode
  // and invent a plausible sequence from the label time, so the /track page can be tested end to end.
  async track(env, trackingNumber) {
    if (env.EASYSHIP_TOKEN) return [];
    const h = (n: number) => new Date(Date.now() - n * 3600_000).toISOString();
    const step = Math.floor(Date.now() / 3600_000) % 4; // 0..3, advances once an hour so the demo moves
    const all: TrackingEvent[] = [
      { at: h(30), status: 'label_created', description: 'Shipping label created', location: 'Monroe, LA 71201' },
      { at: h(26), status: 'in_transit', description: 'Accepted at USPS origin facility', location: 'Monroe, LA 71201' },
      { at: h(14), status: 'in_transit', description: 'Arrived at USPS regional facility', location: 'Shreveport, LA' },
      { at: h(3), status: 'out_for_delivery', description: 'Out for delivery', location: 'Destination' },
    ];
    return all.slice(0, step + 1);
  },
};
