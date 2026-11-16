// Which carrier a tracking number probably belongs to, from its shape, with a link to that carrier's
// own tracking page (Peter, Nov 14 2026). Used on /track when a number isn't one the store shipped, so
// the customer gets a way forward instead of "not found". Some shapes fit two carriers (a 20-digit number
// can be USPS or FedEx), so this returns every match. Pure: safe in the browser, tested in tests/carrier-track.test.ts.

export interface CarrierLink { carrier: 'USPS' | 'UPS' | 'FedEx' | 'DHL'; url: string }

const LINKS: Record<CarrierLink['carrier'], (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${n}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  DHL: (n) => `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${n}`,
};

/** The carriers whose tracking numbers look like this one, most likely first. Empty when nothing matches. */
export function carriersFor(raw: string): CarrierLink[] {
  const n = raw.replace(/[\s-]/g, '').toUpperCase();
  const out: CarrierLink['carrier'][] = [];
  if (/^1Z[0-9A-Z]{16}$/.test(n)) out.push('UPS');
  if (/^(9[1-5]\d{18,24}|[A-Z]{2}\d{9}US)$/.test(n)) out.push('USPS');       // 20 to 26 digits starting 91 to 95, or the international S10 format
  if (/^(\d{12}|\d{15}|96\d{20}|\d{20})$/.test(n)) out.push('FedEx');        // Express 12, Ground 15, SmartPost-style 22, and 20
  if (/^\d{10}$/.test(n)) out.push('DHL');                                  // DHL Express waybill
  return [...new Set(out)].map((carrier) => ({ carrier, url: LINKS[carrier](encodeURIComponent(n)) }));
}
