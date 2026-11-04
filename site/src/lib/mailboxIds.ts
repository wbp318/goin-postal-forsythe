// ID verification for the physical mailboxes (v1.77.0). A Commercial Mail Receiving Agency may only
// hand out a box after seeing two forms of ID from the applicant (USPS PS Form 1583, DMM 508.1.8):
// one must carry a photo, one must show the applicant's current home address, both must be current,
// and some things are never accepted (Social Security cards, credit cards, birth certificates).
// This file is the rulebook: what counts, and why a pair is refused. The counter page asks for the
// two IDs field by field instead of a free-text note, and the API refuses the pair when a rule fails.
// Only the kind, the issuer, the last four characters and the expiry are kept: never the full number.

export type IdSlot = 'primary' | 'secondary';
export interface IdKind { id: string; name: string; photo: boolean; address: boolean; expires: boolean }

/** What PS Form 1583 (2023) accepts. photo: a photo ID, fit for the first slot. address: can show the
 *  current home address. expires: carries an expiry date that must be in the future. */
export const ID_KINDS: IdKind[] = [
  { id: 'drivers_license', name: "Driver's license or state ID", photo: true, address: true, expires: true },
  { id: 'passport', name: 'Passport', photo: true, address: false, expires: true },
  { id: 'passport_card', name: 'US passport card', photo: true, address: false, expires: true },
  { id: 'military_id', name: 'Military or uniformed service ID', photo: true, address: false, expires: true },
  { id: 'government_id', name: 'Government employee ID', photo: true, address: false, expires: true },
  { id: 'university_id', name: 'University ID', photo: true, address: false, expires: true },
  { id: 'corporate_id', name: 'Recognized corporate ID', photo: true, address: false, expires: true },
  { id: 'resident_card', name: 'Permanent resident (alien registration) card', photo: true, address: false, expires: true },
  { id: 'naturalization', name: 'Certificate of naturalization', photo: true, address: false, expires: false },
  { id: 'tribal_id', name: 'Tribal ID', photo: true, address: true, expires: true },
  { id: 'lease', name: 'Current lease, mortgage or deed of trust', photo: false, address: true, expires: false },
  { id: 'voter_card', name: 'Voter registration card', photo: false, address: true, expires: false },
  { id: 'vehicle_registration', name: 'Vehicle registration card', photo: false, address: true, expires: true },
  { id: 'insurance_policy', name: 'Home or vehicle insurance policy', photo: false, address: true, expires: true },
];
/** Shown on the page so staff know to turn these down. */
export const NEVER_ACCEPTED = ['Social Security card', 'Credit or debit card', 'Birth certificate'];

export const idKind = (id: string) => ID_KINDS.find((k) => k.id === id) ?? null;

export interface IdSeen {
  kind: string;
  /** Who issued it: a state, a country, an insurer, a landlord. */
  issuer: string;
  /** The last four characters of the number, or empty for a lease. Never the whole number. */
  last4: string;
  /** YYYY-MM-DD, or empty when the kind does not expire. */
  expires: string;
  /** Staff confirmed the applicant's current home address is printed on it. */
  shows_address: boolean;
}

/** Tidy one ID from a form or a JSON body. Throws nothing: checkIds says what is wrong. */
export function cleanId(x: any): IdSeen {
  return {
    kind: String(x?.kind ?? '').trim().slice(0, 30),
    issuer: String(x?.issuer ?? '').trim().slice(0, 40),
    last4: String(x?.last4 ?? '').trim().replace(/\s+/g, '').slice(-4).toUpperCase(),
    expires: String(x?.expires ?? '').trim().slice(0, 10),
    shows_address: x?.shows_address === true || x?.shows_address === 'on' || x?.shows_address === 'true' || x?.shows_address === 1,
  };
}

const isDate = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x));

/** Problems with one ID in a slot, as sentences for the counter. Empty means it is fine. */
export function checkId(id: IdSeen, slot: IdSlot, today = new Date().toISOString().slice(0, 10)): string[] {
  const out: string[] = [];
  const k = idKind(id.kind);
  const label = slot === 'primary' ? 'The photo ID' : 'The second ID';
  if (!k) { out.push(`${label}: pick what it is from the list`); return out; }
  if (slot === 'primary' && !k.photo) out.push(`${label} must carry a photo: a ${k.name.toLowerCase()} does not`);
  if (!id.issuer) out.push(`${label}: who issued it (the state, country, insurer or landlord)`);
  if (k.expires) {
    if (!isDate(id.expires)) out.push(`${label}: the expiry date, as YYYY-MM-DD`);
    else if (id.expires < today) out.push(`${label} expired ${id.expires}: USPS does not accept an expired ID`);
  }
  if (id.shows_address && !k.address) out.push(`${label}: a ${k.name.toLowerCase()} does not show a home address`);
  return out;
}

/** The pair, as PS Form 1583 wants it: a photo ID, a different second ID, one with the current
 *  address, nothing expired. Empty means the form may be recorded. */
export function checkIds(primary: IdSeen, secondary: IdSeen, today = new Date().toISOString().slice(0, 10)): string[] {
  const out = [...checkId(primary, 'primary', today), ...checkId(secondary, 'secondary', today)];
  if (out.length) return out;
  if (primary.kind === secondary.kind) out.push('The two IDs must be different kinds of ID');
  if (!primary.shows_address && !secondary.shows_address) out.push("One of the two must show the applicant's current home address, and you must tick that it does");
  return out;
}

/** How one ID reads in a log line or the mailbox's ids_seen summary: "LA driver's license or state ID …1234, exp 2029-04-01". */
export function describeId(id: IdSeen): string {
  const k = idKind(id.kind);
  return [`${id.issuer} ${k?.name ?? id.kind}`.trim(), id.last4 ? `…${id.last4}` : '', id.expires ? `exp ${id.expires}` : ''].filter(Boolean).join(' ');
}

/** True when the ID has an expiry and it has passed: the holder must bring a current one before the
 *  box renews (the list page flags it). */
export const idExpired = (expires: string | null, today = new Date().toISOString().slice(0, 10)) => !!expires && expires < today;
