// Address checks before a label is bought. What can be done with no carrier account: the ZIP's
// shape, whether its first three digits belong to the state typed, PO boxes (UPS and FedEx do not
// deliver to them), military and territory addresses, and a nudge when a street line looks like an
// apartment building with no unit number. The carriers' own address APIs (USPS Addresses 3.0, UPS
// Address Validation) plug into validateWithCarrier() once the keys from issue 12 exist; until then
// it returns null and these checks stand alone.
import type { Address } from '../shipping/types';

export interface AddressCheck {
  errors: string[];     // stop: the label would be wrong
  warnings: string[];   // tell: worth a second look
  po_box: boolean;
  military: boolean;
  territory: boolean;
  zip_state: string | null; // the state the ZIP prefix belongs to, when known
}

// First three digits of the ZIP by state, as USPS assigns them. Ranges are inclusive.
const PREFIXES: [string, [number, number][]][] = [
  ['AL', [[350, 369]]], ['AK', [[995, 999]]], ['AZ', [[850, 865]]], ['AR', [[716, 729]]],
  ['CA', [[900, 961]]], ['CO', [[800, 816]]], ['CT', [[60, 69]]], ['DE', [[197, 199]]], ['DC', [[200, 205]]],
  ['FL', [[320, 349]]], ['GA', [[300, 319], [398, 399]]], ['HI', [[967, 968]]], ['ID', [[832, 838]]],
  ['IL', [[600, 629]]], ['IN', [[460, 479]]], ['IA', [[500, 528]]], ['KS', [[660, 679]]], ['KY', [[400, 427]]],
  ['LA', [[700, 714]]], ['ME', [[39, 49]]], ['MD', [[206, 219]]], ['MA', [[10, 27], [55, 55]]], ['MI', [[480, 499]]],
  ['MN', [[550, 567]]], ['MS', [[386, 397]]], ['MO', [[630, 658]]], ['MT', [[590, 599]]], ['NE', [[680, 693]]],
  ['NV', [[889, 898]]], ['NH', [[30, 38]]], ['NJ', [[70, 89]]], ['NM', [[870, 884]]], ['NY', [[5, 5], [100, 149]]],
  ['NC', [[270, 289]]], ['ND', [[580, 588]]], ['OH', [[430, 459]]], ['OK', [[730, 749]]], ['OR', [[970, 979]]],
  ['PA', [[150, 196]]], ['RI', [[28, 29]]], ['SC', [[290, 299]]], ['SD', [[570, 577]]], ['TN', [[370, 385]]],
  ['TX', [[733, 733], [750, 799], [885, 885]]], ['UT', [[840, 847]]], ['VT', [[50, 59]]], ['VA', [[201, 201], [220, 246]]],
  ['WA', [[980, 994]]], ['WV', [[247, 268]]], ['WI', [[530, 549]]], ['WY', [[820, 831]]],
  ['PR', [[6, 9]]], ['VI', [[8, 8]]], ['GU', [[969, 969]]], ['AS', [[967, 967]]], ['MP', [[969, 969]]],
  ['AA', [[340, 340]]], ['AE', [[90, 98]]], ['AP', [[962, 966]]],
];
const TERRITORIES = new Set(['PR', 'VI', 'GU', 'AS', 'MP']);
const MILITARY = new Set(['AA', 'AE', 'AP']);

export function stateForZip(zip: string): string[] {
  const n = Number(zip.slice(0, 3));
  if (!Number.isFinite(n)) return [];
  return PREFIXES.filter(([, ranges]) => ranges.some(([a, b]) => n >= a && n <= b)).map(([st]) => st);
}

export const isPoBox = (line: string) => /\b(p\.?\s*o\.?\s*box|post\s*office\s*box|pob)\b/i.test(line) || /^\s*box\s+\d+/i.test(line);

/** The checks that need no carrier. Errors stop a label; warnings are shown and the label can go ahead. */
export function checkAddress(a: Address): AddressCheck {
  const out: AddressCheck = { errors: [], warnings: [], po_box: false, military: false, territory: false, zip_state: null };
  if (a.country_alpha2 !== 'US') return out;
  const zip = a.postal_code.trim();
  if (!/^\d{5}(-\d{4})?$/.test(zip)) { out.errors.push('A US ZIP code is five digits, like 71201, or nine like 71201-1234.'); return out; }
  const states = stateForZip(zip);
  out.zip_state = states[0] ?? null;
  out.military = MILITARY.has(a.state) || states.some((s) => MILITARY.has(s));
  out.territory = TERRITORIES.has(a.state) || states.some((s) => TERRITORIES.has(s));
  if (!states.length) out.warnings.push(`ZIP ${zip} does not look like a ZIP code in use. Check it with the customer.`);
  else if (!states.includes(a.state)) out.errors.push(`ZIP ${zip} belongs to ${states.join(' or ')}, not ${a.state}. One of them is wrong.`);
  out.po_box = isPoBox(a.line_1) || (!!a.line_2 && isPoBox(a.line_2));
  if (out.po_box) out.warnings.push('This is a PO Box. UPS and FedEx cannot deliver to it; use USPS.');
  if (out.military) out.warnings.push('Military address (APO, FPO, DPO): USPS only, and a customs form is needed.');
  if (out.territory) out.warnings.push('US territory: USPS treats it as domestic; UPS and FedEx add remote-area charges.');
  const looksMulti = /\b(apartments?|apts?|complex|towers?|plaza|village|court|lofts?|condos?|residences?)\b/i.test(a.line_1);
  const hasUnit = /\b(apt|apartment|suite|ste|unit|#|rm|room|fl|floor|bldg|building)\b|#\s*\w+/i.test(`${a.line_1} ${a.line_2 ?? ''}`);
  if (looksMulti && !hasUnit) out.warnings.push('This looks like an apartment building with no unit number. Ask for the apartment or suite.');
  if (!/\d/.test(a.line_1) && !out.po_box) out.warnings.push('The street line has no house number.');
  return out;
}

/** Hook for the carriers' address APIs. Returns null until USPS or UPS keys exist (issue 12). */
export async function validateWithCarrier(_env: Env, _a: Address): Promise<{ standardized: Address; dpv: boolean } | null> {
  return null;
}
