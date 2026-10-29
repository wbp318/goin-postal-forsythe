// Batch shipping (to-do T11): a business account's stack of orders as one CSV, every row checked
// and rated, labels bought in one go and printed in order. Three CSV shapes are understood without
// any mapping step: PeterShip's own columns, a Shopify orders export, and an Etsy orders export.
// Everything is priced on the server, the account's discount applied like a single label.
import type { Address, Parcel, Rate } from '../shipping/types';
import { parseAddress, parseParcel } from './validate';
import { checkAddress } from './address';
import { quote } from './quote';
import { store } from '../data/store';
import { benchmarkFor, type Benchmark } from './benchmark';

export const MAX_ROWS = 200;

export interface ParcelDefaults { weight_lb: number; length_in: number; width_in: number; height_in: number; value_usd?: number; description?: string }
export interface BatchRow {
  line: number;                 // 1-based data row in the file
  reference: string;            // order number or whatever the seller uses
  to: Address | null;
  parcel: Parcel | null;
  errors: string[];
  warnings: string[];
}
export type Pick = 'cheapest' | 'fastest' | { service: string };
export interface RatedRow extends BatchRow { rates: Rate[]; chosen: Rate | null; benchmark?: Benchmark | null }

// ---- CSV -------------------------------------------------------------------------------------

/** A small CSV reader: quotes, doubled quotes, commas and newlines inside quotes, CRLF, a BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'puerto rico': 'PR',
};
/** "Louisiana" or "la" to LA. Unknown names pass through for the address check to reject. */
export const stateCode = (v: string) => { const t = v.trim(); return STATES[t.toLowerCase()] ?? t.toUpperCase(); };
const COUNTRIES: Record<string, string> = { 'united states': 'US', usa: 'US', us: 'US', 'united states of america': 'US', canada: 'CA', mexico: 'MX', 'united kingdom': 'GB', uk: 'GB' };
export const countryCode = (v: string) => { const t = v.trim(); return t ? COUNTRIES[t.toLowerCase()] ?? t.toUpperCase().slice(0, 2) : 'US'; };

// Column aliases, lower-cased, spaces and underscores folded. First match wins.
type Field = 'reference' | 'name' | 'company' | 'phone' | 'email' | 'line_1' | 'line_2' | 'city' | 'state' | 'zip' | 'country' | 'weight_lb' | 'weight_oz' | 'weight_g' | 'length_in' | 'width_in' | 'height_in' | 'value_usd' | 'description';
const ALIASES: Record<Field, string[]> = {
  reference: ['reference', 'order', 'order number', 'order id', 'order #', 'order name', 'order-id', 'sales record number'],
  name: ['ship to', 'ship to name', 'shipping name', 'ship name', 'recipient', 'recipient name', 'recipient-name', 'to name', 'customer', 'full name', 'contact name', 'name'],
  company: ['company', 'shipping company', 'ship company', 'company name', 'ship to company', 'shipping company name'],
  phone: ['phone', 'shipping phone', 'ship phone', 'contact phone', 'recipient phone', 'ship to phone', 'buyer phone', 'ship-phone-number', 'shipping phone number'],
  email: ['email', 'contact email', 'buyer email', 'customer email', 'buyer-email', 'billing email'],
  line_1: ['address1', 'address 1', 'address', 'street', 'shipping address1', 'shipping address 1', 'shipping street', 'ship address1', 'ship address 1', 'ship to address 1', 'ship-address-1', 'shipping address line 1', 'line 1', 'line1', 'street 1'],
  line_2: ['address2', 'address 2', 'shipping address2', 'shipping address 2', 'ship address2', 'ship address 2', 'ship to address 2', 'ship-address-2', 'shipping address line 2', 'line 2', 'line2', 'apt', 'suite', 'street 2'],
  city: ['city', 'shipping city', 'ship city', 'ship to city', 'ship-city'],
  state: ['state', 'province', 'shipping province', 'shipping province name', 'ship state', 'ship to state', 'ship to province', 'ship-state', 'shipping state', 'state/province', 'region'],
  zip: ['zip', 'zipcode', 'zip code', 'postal code', 'postcode', 'shipping zip', 'ship zipcode', 'ship zip', 'ship to zip', 'ship to postal code', 'ship to post code', 'ship-postal-code', 'shipping postcode', 'shipping postal code'],
  country: ['country', 'shipping country', 'ship country', 'ship to country', 'ship-country', 'country code', 'shipping country code'],
  weight_lb: ['weight lb', 'weight lbs', 'weight (lb)', 'weight (lbs)', 'lb', 'lbs', 'pounds', 'weight'],
  weight_oz: ['weight oz', 'weight (oz)', 'oz', 'ounces'],
  weight_g: ['total weight', 'weight g', 'weight (g)', 'grams', 'weight (grams)'],
  length_in: ['length in', 'length', 'l'],
  width_in: ['width in', 'width', 'w'],
  height_in: ['height in', 'height', 'h'],
  value_usd: ['value', 'value usd', 'declared value', 'total', 'order total', 'subtotal', 'sale amount'],
  description: ['description', 'contents', 'item', 'items', 'lineitem name', 'item name', 'item title', 'product', 'product-name', 'product name'],
};
const fold = (h: string) => h.trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ');

/** Which column feeds which field, by the header row. */
export function mapColumns(headers: string[]): Partial<Record<Field, number>> {
  const folded = headers.map(fold);
  const map: Partial<Record<Field, number>> = {};
  // The recipient's name first, so a plain "name" column is the person, not the order.
  const order = ['name', ...(Object.keys(ALIASES) as Field[]).filter((f) => f !== 'name')] as Field[];
  for (const f of order) {
    for (const a of ALIASES[f]) {
      const i = folded.indexOf(a);
      if (i >= 0 && !Object.values(map).includes(i)) { map[f] = i; break; }
    }
  }
  // Shopify: its "Name" column is the order number (#1001) beside a separate "Shipping Name".
  const plainName = folded.indexOf('name');
  if (map.reference == null && plainName >= 0 && map.name != null && map.name !== plainName) map.reference = plainName;
  return map;
}

export type Format = 'petership' | 'shopify' | 'etsy' | 'ebay' | 'square' | 'woocommerce' | 'amazon' | 'unknown';
export function detectFormat(headers: string[]): Format {
  const f = headers.map(fold);
  if (f.includes('shipping address1') && f.includes('financial status')) return 'shopify';
  if (f.includes('ship address1') || f.includes('ship zipcode')) return 'etsy';
  if (f.includes('ship to address 1') || f.includes('sales record number')) return 'ebay';
  if (f.includes('ship-address-1') || f.includes('recipient-name')) return 'amazon';
  if (f.includes('shipping address line 1') || (f.includes('recipient name') && f.includes('shipping postal code'))) return 'square';
  if (f.includes('shipping first name') || f.includes('shipping postcode')) return 'woocommerce';
  if (f.includes('address1') && f.includes('zip')) return 'petership';
  return 'unknown';
}

/** The rows of a CSV as addresses and parcels. Missing parcel columns take the batch defaults. A Shopify export repeats an order per line item with the address only on the first line, so those are folded into one row. */
export function parseBatch(text: string, defaults: ParcelDefaults): { format: Format; headers: string[]; rows: BatchRow[]; skipped: number } {
  const table = parseCsv(text);
  if (table.length < 2) return { format: 'unknown', headers: table[0] ?? [], rows: [], skipped: 0 };
  const headers = table[0];
  const map = mapColumns(headers);
  const format = detectFormat(headers);
  const col = (r: string[], f: Field) => (map[f] == null ? '' : (r[map[f]!] ?? '').trim());
  // WooCommerce exports split the recipient into first and last name columns.
  const firstCol = headers.map(fold).indexOf('shipping first name'), lastCol = headers.map(fold).indexOf('shipping last name');
  const nameOf = (r: string[]) => col(r, 'name') || (firstCol >= 0 ? `${(r[firstCol] ?? '').trim()} ${lastCol >= 0 ? (r[lastCol] ?? '').trim() : ''}`.trim() : '');
  const rows: BatchRow[] = [];
  let skipped = 0;
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    if (!col(r, 'line_1') && !col(r, 'zip')) { skipped++; continue; } // a line-item line without an address, or a blank
    if (rows.length >= MAX_ROWS) { skipped++; continue; }
    const row: BatchRow = { line: i, reference: col(r, 'reference').slice(0, 40), to: null, parcel: null, errors: [], warnings: [] };
    try {
      const to = parseAddress({
        contact_name: nameOf(r) || col(r, 'company'), company_name: col(r, 'company') || undefined,
        contact_phone: col(r, 'phone'), contact_email: col(r, 'email'),
        line_1: col(r, 'line_1'), line_2: col(r, 'line_2'), city: col(r, 'city'), state: stateCode(col(r, 'state')), postal_code: col(r, 'zip').replace(/^'/, ''), country_alpha2: countryCode(col(r, 'country')),
      });
      const c = checkAddress(to);
      row.errors.push(...c.errors); row.warnings.push(...c.warnings);
      row.to = to;
    } catch (e: any) { row.errors.push(e.message); }
    try {
      const lb = col(r, 'weight_lb'), oz = col(r, 'weight_oz'), g = col(r, 'weight_g');
      const weight = lb ? Number(lb) : oz ? Number(oz) / 16 : g ? Number(g) / 453.592 : defaults.weight_lb;
      const num = (f: Field, d: number) => (col(r, f) ? Number(col(r, f)) : d);
      row.parcel = parseParcel({
        weight_lb: Math.round(weight * 100) / 100, length_in: num('length_in', defaults.length_in), width_in: num('width_in', defaults.width_in), height_in: num('height_in', defaults.height_in),
        value_usd: num('value_usd', defaults.value_usd ?? 1), description: col(r, 'description') || defaults.description || 'Merchandise',
      });
    } catch (e: any) { row.errors.push(e.message); }
    if (row.to && row.to.country_alpha2 !== 'US') row.errors.push('International rows need customs paperwork; ship them one at a time at the counter');
    rows.push(row);
  }
  return { format, headers, rows, skipped };
}

// ---- rating and choosing -------------------------------------------------------------------------

export function choose(rates: Rate[], pick: Pick): Rate | null {
  if (!rates.length) return null;
  const byPrice = [...rates].sort((a, b) => a.total_charge - b.total_charge);
  if (pick === 'cheapest') return byPrice[0];
  if (pick === 'fastest') return [...rates].sort((a, b) => (a.max_days ?? 99) - (b.max_days ?? 99) || a.total_charge - b.total_charge)[0];
  const want = pick.service.toLowerCase();
  return byPrice.find((r) => `${r.carrier} ${r.service}`.toLowerCase().includes(want)) ?? null;
}

export const discounted = (r: Rate, percent: number) => (percent ? { ...r, total_charge: Math.round(r.total_charge * (1 - percent / 100) * 100) / 100 } : r);

/** Quote every good row and pick a service for it. Rows with errors are left unrated. */
export async function rateBatch(env: Env, rows: BatchRow[], pick: Pick, discountPercent = 0): Promise<RatedRow[]> {
  const out: RatedRow[] = [];
  for (const row of rows) {
    if (row.errors.length || !row.to || !row.parcel) { out.push({ ...row, rates: [], chosen: null }); continue; }
    try {
      const { rates } = await quote(env, store.origin, row.to, row.parcel);
      const offered = rates.map((r) => discounted(r, discountPercent));
      const chosen = choose(offered, pick);
      const warnings = [...row.warnings];
      if (!chosen && offered.length && typeof pick === 'object') warnings.push(`No ${pick.service} rate for this row; pick another service or let it take the cheapest`);
      out.push({ ...row, warnings, rates: offered, chosen, benchmark: benchmarkFor(row.to, row.parcel, offered), errors: offered.length ? row.errors : [...row.errors, 'No rates for this address and parcel'] });
    } catch (e: any) {
      out.push({ ...row, rates: [], chosen: null, errors: [...row.errors, e.message] });
    }
  }
  return out;
}

export const batchTotal = (rows: RatedRow[]) => Math.round(rows.reduce((a, r) => a + (r.chosen?.total_charge ?? 0), 0) * 100) / 100;

/** Results as a CSV the seller can paste back into their shop: reference, code, carrier, service, tracking, price. */
export function resultsCsv(results: { reference: string; id: string | null; carrier: string | null; service: string | null; tracking_number: string | null; price: number | null; error: string | null }[]): string {
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = ['reference,code,carrier,service,tracking_number,price,error'];
  for (const r of results) lines.push([r.reference, r.id, r.carrier, r.service, r.tracking_number, r.price, r.error].map(esc).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}
