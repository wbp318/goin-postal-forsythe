// Extra services a customer ticks on the ship page (Peter, Nov 14 2026, modelled on Pirate Ship):
// signature confirmation, Media Mail, irregular package and hazardous materials. They travel on the
// parcel as `options`, change which rates are offered, and reach the carrier on the label.
// Pure functions, no imports beyond types and the packaging list: tested directly in tests/options.test.ts.
import type { Address, Rate } from '../shipping/types';
import { packagingById } from './packaging';

export interface ShipOptions {
  /** Someone signs on delivery. Priced from the add-on catalog (code "signature"); sent to the carrier on the label. */
  signature?: boolean;
  /** USPS Media Mail is offered (books, printed music, recordings, films only). Hidden unless ticked. */
  media_mail?: boolean;
  /** Not a regular box (tubes, rolls, odd shapes): USPS prices it as nonstandard. */
  irregular?: boolean;
  /** Limited-quantity hazardous materials: USPS Ground Advantage only, declared on the label. */
  hazmat?: boolean;
  /** Return labels (Peter, Nov 14 2026, like Pirate Ship). "only": one label with the addresses swapped,
   *  from the receiver back to the sender. "included": the outgoing label plus a return label. Charged
   *  now, at the price shown; pay-only-if-used is a later decision (peter/FOR-WILLIAM.md). */
  return_label?: 'only' | 'included';
}

export const MEDIA_MAIL_ID = 'usps:MEDIA_MAIL';

/** Reads the options from a request body; anything not exactly true is off. */
export function parseOptions(v: any): ShipOptions {
  const on = (k: keyof ShipOptions) => v?.[k] === true || v?.[k] === 'on';
  const o: ShipOptions = {};
  for (const k of ['signature', 'media_mail', 'irregular', 'hazmat'] as const) if (on(k)) o[k] = true;
  if (v?.return_label === 'only' || v?.return_label === 'included') o.return_label = v.return_label;
  return o;
}

/** A short code for the rate cache key, so a quote with options never reuses one without. */
export function optionsKey(o: ShipOptions | undefined): string {
  return o ? ['signature', 'media_mail', 'irregular', 'hazmat'].filter((k) => o[k as keyof ShipOptions]).map((k) => k[0]).join('') + (o.return_label ? `r${o.return_label[0]}` : '') : '';
}

const isMediaMail = (r: Rate) => r.id === MEDIA_MAIL_ID || (r.carrier === 'USPS' && /media mail/i.test(r.service));
const isGroundAdvantage = (r: Rate) => r.carrier === 'USPS' && /ground advantage/i.test(r.service);

/** The rates a customer may pick with these options. Media Mail only when ticked; hazardous materials
 *  only by USPS Ground Advantage (they cannot fly, and Media Mail may not carry them). */
export function applyOptions(rates: Rate[], o: ShipOptions | undefined): Rate[] {
  let out = rates.filter((r) => !isMediaMail(r) || !!o?.media_mail);
  if (o?.hazmat) out = out.filter(isGroundAdvantage);
  return out;
}

/** Signature confirmation, hazardous materials and a carrier's own packaging reach the carrier only through
 *  the direct USPS, UPS and FedEx adapters (lib/labelExtras.ts, lib/packaging.ts). The Easyship request
 *  carries insurance only and the DHL adapter none of them, so their rates are not offered for such a parcel. */
export function needsDirectCarrier(p: { options?: ShipOptions; packaging?: string }): boolean {
  const pk = packagingById(p.packaging);
  return !!(p.options?.signature || p.options?.hazmat || (pk && pk.group !== 'own'));
}
const NOT_CARRIED_BY = new Set(['easyship', 'dhl']);

/** The rates whose adapter puts the parcel's signature, hazmat and packaging choices on the label. Unchanged when none is chosen. */
export function carriesExtras(rates: Rate[], p: { options?: ShipOptions; packaging?: string }): Rate[] {
  return needsDirectCarrier(p) ? rates.filter((r) => !NOT_CARRIED_BY.has(r.id.split(':')[0])) : rates;
}
export const NO_CARRIER_FOR_EXTRAS = 'Signature confirmation, hazardous materials and carrier packaging can be bought online only with a carrier that puts them on the label, and none is available for this package yet. Untick them, or bring the package to the counter.';

/** States where hazardous packages may be bought online: the lower 48 and DC, which USPS reaches by
 *  ground. Alaska, Hawaii, the territories and military addresses go through the counter instead. */
const NOT_BY_GROUND = new Set(['AK', 'HI', 'PR', 'VI', 'GU', 'AS', 'MP', 'AA', 'AE', 'AP']);
export const HAZMAT_AREA = 'Hazardous materials can be bought online only between addresses in the lower 48 states and DC. For Alaska, Hawaii, the US territories and military addresses, bring the package to the counter.';

export function hazmatAllowed(origin: Address, destination: Address): boolean {
  return !NOT_BY_GROUND.has(origin.state.toUpperCase()) && !NOT_BY_GROUND.has(destination.state.toUpperCase());
}

/** "Return label only" swaps the two addresses: the label runs from the receiver back to the sender. */
export function directed<A>(origin: A, destination: A, o: ShipOptions | undefined): { origin: A; destination: A; kind: 'ship' | 'return' } {
  return o?.return_label === 'only' ? { origin: destination, destination: origin, kind: 'return' } : { origin, destination, kind: 'ship' };
}

/** The return label to go with an outgoing rate ("Return label included"): the same service the other
 *  way if it is offered, else the same carrier's cheapest, else the cheapest of all. */
export function pickReturnRate(outbound: Rate, reverse: Rate[]): Rate | undefined {
  const cheapest = (list: Rate[]) => [...list].sort((a, b) => a.total_charge - b.total_charge)[0];
  return reverse.find((r) => r.id === outbound.id) ?? cheapest(reverse.filter((r) => r.carrier === outbound.carrier)) ?? cheapest(reverse);
}

/** A parcel for the return label: same box, without the outgoing extras (no signature, no insurance, no return of its own). */
export function returnParcel<P extends { options?: ShipOptions; insured_usd?: number }>(p: P): P {
  const { signature, return_label, ...keep } = p.options ?? {};
  const { insured_usd, ...rest } = p;
  return { ...rest, options: keep } as P;
}
