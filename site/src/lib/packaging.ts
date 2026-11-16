// Packaging the customer ships in (Peter, Nov 14 2026, modelled on Pirate Ship's picker): their own
// box, envelope or tube, or a carrier's branded packaging. Carrier packaging ships with that carrier
// only, on the services it is made for, and its size is known, so the customer only types the weight.
// The carrier is told which packaging it is, when pricing and on the label (codes below).
//
// Pictures live in site/public/packaging/: SVGs drawn for the store, one set for USPS, UPS, FedEx and
// the general ones, in the carriers' colors with plain product words and no carrier logos.
// Carrier codes and sizes follow each carrier's published references; check them on the first real
// label from each carrier. Pure data and functions: safe in the browser, tested in tests/packaging.test.ts.
import type { Rate } from '../shipping/types';

export type PackagingGroup = 'own' | 'USPS' | 'UPS' | 'FedEx';

export interface Packaging {
  id: string;
  group: PackagingGroup;
  name: string;                       // English; the product name for carrier packaging
  nameKey?: string;                   // i18n key for the store's own wording (own packaging)
  descKey: string;                    // i18n key for the line under the name
  img: string;                        // path under site/public
  dims?: [number, number, number];    // inches, length x width x height; carrier packaging only
  maxLb?: number;                     // the most the packaging may weigh
  usps?: string;                      // USPS rateIndicator
  ups?: string;                       // UPS PackagingType code
  fedex?: string;                     // FedEx packagingType
  services?: RegExp;                  // which of that carrier's services may carry it (by service name)
}

const PRIORITY = /^USPS Priority Mail$/;
const EXPRESS = /^USPS Priority Mail Express$/;
const UPS_AIR = /Air|Worldwide/;                 // not UPS Ground, 3 Day Select or Standard
const FEDEX_EXPRESS = /Express Saver|2Day|Overnight|International/; // not FedEx Ground or Home Delivery
const FLAT = 'pkg.flat', USPS_EXP = 'pkg.usps.exp', UPS_D = 'pkg.ups', FEDEX_D = 'pkg.fedex';

export const PACKAGING: Packaging[] = [
  { id: 'soft', group: 'own', name: 'Envelope, padded envelope, poly bag or soft pack', nameKey: 'pkg.soft', descKey: 'pkg.soft.d', img: '/packaging/soft.svg', usps: 'SP' },
  { id: 'box', group: 'own', name: 'Box or rigid packaging', nameKey: 'pkg.box', descKey: 'pkg.box.d', img: '/packaging/box.svg', usps: 'SP' },
  { id: 'tube', group: 'own', name: 'Tube or irregular packaging', nameKey: 'pkg.tube', descKey: 'pkg.tube.d', img: '/packaging/tube.svg', usps: 'SP' },

  { id: 'usps-fr-small-box', group: 'USPS', name: 'USPS Priority Mail Small Flat Rate Box', descKey: FLAT, img: '/packaging/usps-fr-small-box.svg', dims: [8.6, 5.4, 1.6], maxLb: 70, usps: 'FS', services: PRIORITY },
  { id: 'usps-fr-medium-box', group: 'USPS', name: 'USPS Priority Mail Medium Flat Rate Box', descKey: FLAT, img: '/packaging/usps-fr-medium-box.svg', dims: [11, 8.5, 5.5], maxLb: 70, usps: 'FB', services: PRIORITY },
  { id: 'usps-fr-large-box', group: 'USPS', name: 'USPS Priority Mail Large Flat Rate Box', descKey: FLAT, img: '/packaging/usps-fr-large-box.svg', dims: [12, 12, 5.5], maxLb: 70, usps: 'PL', services: PRIORITY },
  { id: 'usps-fr-envelope', group: 'USPS', name: 'USPS Priority Mail Flat Rate Envelope', descKey: FLAT, img: '/packaging/usps-fr-envelope.svg', dims: [12.5, 9.5, 1], maxLb: 70, usps: 'FE', services: PRIORITY },
  { id: 'usps-fr-legal-envelope', group: 'USPS', name: 'USPS Priority Mail Legal Flat Rate Envelope', descKey: FLAT, img: '/packaging/usps-fr-legal-envelope.svg', dims: [15, 9.5, 1], maxLb: 70, usps: 'FA', services: PRIORITY },
  { id: 'usps-fr-padded-envelope', group: 'USPS', name: 'USPS Priority Mail Padded Flat Rate Envelope', descKey: FLAT, img: '/packaging/usps-fr-padded-envelope.svg', dims: [12.5, 9.5, 1], maxLb: 70, usps: 'FP', services: PRIORITY },
  { id: 'usps-express-envelope', group: 'USPS', name: 'USPS Priority Mail Express Flat Rate Envelope', descKey: USPS_EXP, img: '/packaging/usps-express-envelope.svg', dims: [12.5, 9.5, 1], maxLb: 70, usps: 'E4', services: EXPRESS },
  { id: 'usps-express-legal-envelope', group: 'USPS', name: 'USPS Priority Mail Express Legal Flat Rate Envelope', descKey: USPS_EXP, img: '/packaging/usps-express-legal-envelope.svg', dims: [15, 9.5, 1], maxLb: 70, usps: 'E6', services: EXPRESS },
  { id: 'usps-express-padded-envelope', group: 'USPS', name: 'USPS Priority Mail Express Padded Flat Rate Envelope', descKey: USPS_EXP, img: '/packaging/usps-express-padded-envelope.svg', dims: [12.5, 9.5, 1], maxLb: 70, usps: 'PA', services: EXPRESS },

  { id: 'ups-express-envelope', group: 'UPS', name: 'UPS Express Envelope', descKey: UPS_D, img: '/packaging/ups-express-envelope.svg', dims: [12.5, 9.5, 1], ups: '01', services: UPS_AIR },
  { id: 'ups-small-express-box', group: 'UPS', name: 'UPS Small Express Box', descKey: UPS_D, img: '/packaging/ups-small-express-box.svg', dims: [13, 11, 2], ups: '2a', services: UPS_AIR },
  { id: 'ups-medium-express-box', group: 'UPS', name: 'UPS Medium Express Box', descKey: UPS_D, img: '/packaging/ups-medium-express-box.svg', dims: [16, 11, 3], ups: '2b', services: UPS_AIR },
  { id: 'ups-large-express-box', group: 'UPS', name: 'UPS Large Express Box', descKey: UPS_D, img: '/packaging/ups-large-express-box.svg', dims: [18, 13, 3], ups: '2c', services: UPS_AIR },
  { id: 'ups-express-tube', group: 'UPS', name: 'UPS Express Tube', descKey: UPS_D, img: '/packaging/ups-express-tube.svg', dims: [38, 6, 6], ups: '03', services: UPS_AIR },
  { id: 'ups-express-pak', group: 'UPS', name: 'UPS Express Pak', descKey: UPS_D, img: '/packaging/ups-express-pak.svg', dims: [16, 12.8, 1], ups: '04', services: UPS_AIR },

  { id: 'fedex-envelope', group: 'FedEx', name: 'FedEx Envelope', descKey: FEDEX_D, img: '/packaging/fedex-envelope.svg', dims: [12.5, 9.5, 1], fedex: 'FEDEX_ENVELOPE', services: FEDEX_EXPRESS },
  { id: 'fedex-pak', group: 'FedEx', name: 'FedEx Pak', descKey: FEDEX_D, img: '/packaging/fedex-pak.svg', dims: [15.5, 12, 1], fedex: 'FEDEX_PAK', services: FEDEX_EXPRESS },
  { id: 'fedex-small-box', group: 'FedEx', name: 'FedEx Small Box', descKey: FEDEX_D, img: '/packaging/fedex-small-box.svg', dims: [12.4, 10.9, 1.5], fedex: 'FEDEX_SMALL_BOX', services: FEDEX_EXPRESS },
  { id: 'fedex-medium-box', group: 'FedEx', name: 'FedEx Medium Box', descKey: FEDEX_D, img: '/packaging/fedex-medium-box.svg', dims: [13.3, 11.5, 2.4], fedex: 'FEDEX_MEDIUM_BOX', services: FEDEX_EXPRESS },
  { id: 'fedex-large-box', group: 'FedEx', name: 'FedEx Large Box', descKey: FEDEX_D, img: '/packaging/fedex-large-box.svg', dims: [17.5, 12.4, 3], fedex: 'FEDEX_LARGE_BOX', services: FEDEX_EXPRESS },
  { id: 'fedex-extra-large-box', group: 'FedEx', name: 'FedEx Extra Large Box', descKey: FEDEX_D, img: '/packaging/fedex-extra-large-box.svg', dims: [11.9, 11, 10.8], fedex: 'FEDEX_EXTRA_LARGE_BOX', services: FEDEX_EXPRESS },
  { id: 'fedex-tube', group: 'FedEx', name: 'FedEx Tube', descKey: FEDEX_D, img: '/packaging/fedex-tube.svg', dims: [38, 6, 6], fedex: 'FEDEX_TUBE', services: FEDEX_EXPRESS },
];

export const DEFAULT_PACKAGING = 'box';
export const packagingById = (id: string | undefined): Packaging | undefined => PACKAGING.find((p) => p.id === id);
export const isCarrierPackaging = (p: Packaging | undefined) => !!p && p.group !== 'own';

/** Only the carrier that owns the packaging, on the services it is made for. Own packaging changes nothing. */
export function applyPackaging(rates: Rate[], id: string | undefined): Rate[] {
  const p = packagingById(id);
  if (!p || p.group === 'own') return rates;
  return rates.filter((r) => r.carrier === p.group && (!p.services || p.services.test(r.service)));
}

/** The message when nothing can carry the packaging (for example hazardous materials in a flat rate box, which must go by Ground Advantage). */
export const noServiceFor = (p: Packaging) => `No ${p.group} service can carry the ${p.name} with these choices. Pick other packaging, or untick the option that rules it out.`;

/** Carrier codes for the pricing and label requests. Undefined means the carrier's "your own packaging". */
export const uspsRateIndicator = (id: string | undefined) => packagingById(id)?.usps ?? 'SP';
export const upsPackagingCode = (id: string | undefined) => packagingById(id)?.ups ?? '02';
export const fedexPackagingType = (id: string | undefined) => packagingById(id)?.fedex ?? 'YOUR_PACKAGING';
