// Street-address typeahead (v1.74.0). The ship page sends what the customer has typed in the street
// box and gets back up to five full addresses to pick from, each split into the form's fields.
// Two lookups behind one shape, so the page never changes:
//   - Google Places (New) when GOOGLE_PLACES_KEY is set: the one worth paying for on US house numbers.
//     Autocomplete for the candidates, then Place Details for the components of each. Issue 18.
//   - The US Census Bureau geocoder otherwise: free, official, no key, every US house number, about
//     a second to answer. It wants a city or ZIP with the street (the street box's placeholder says so).
//     No local bias: recipients are anywhere in the country. US only; other countries wait for the Google key.
//     (Photon, the OpenStreetMap search, was tried first and took four to seven seconds a call.)
// The browser only talks to this site. Nothing is stored.
export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';

export interface Suggestion { label: string; line_1: string; city: string; state: string; postal_code: string; country_alpha2: string }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=300' } });

const STATES: Record<string, string> = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'puerto rico': 'PR' };
const abbr = (state: string) => (state.length === 2 ? state.toUpperCase() : STATES[state.toLowerCase()] ?? state);

const title = (x: string) => x.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n, suf) => n + suf.toLowerCase());

/** One Census query: a one-line address in, matched addresses out. Needs a city or a ZIP in the text. */
async function censusOne(address: string): Promise<Suggestion[]> {
  const u = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  u.searchParams.set('address', address); u.searchParams.set('benchmark', 'Public_AR_Current'); u.searchParams.set('format', 'json');
  // Census hangs on text it cannot place (a bare street), so a short timeout is simply no suggestions.
  const res = await fetch(u.toString(), { signal: AbortSignal.timeout(2500) }).catch(() => null);
  if (!res || !res.ok) return [];
  const j: any = await res.json();
  return (j.result?.addressMatches ?? []).map((m: any) => {
    const parts = String(m.matchedAddress ?? '').split(',').map((x: string) => x.trim());
    const [line, city, state, zip] = [parts[0] ?? '', parts[1] ?? m.addressComponents?.city ?? '', parts[2] ?? m.addressComponents?.state ?? '', parts[3] ?? m.addressComponents?.zip ?? ''];
    const line_1 = title(line), c = title(city);
    return { label: [line_1, c, state, zip].filter(Boolean).join(', '), line_1, city: c, state, postal_code: zip, country_alpha2: 'US' } as Suggestion;
  });
}

/** The US Census Bureau geocoder: free, official, every house number in the country, about a second
 *  to answer, no key. It needs a city or ZIP with the street; the placeholder on the street box says so. */
async function census(q: string): Promise<Suggestion[]> {
  const out: Suggestion[] = [];
  for (const s of await censusOne(q)) if (!out.some((o) => o.label === s.label)) out.push(s);
  return out.slice(0, 5);
}

async function google(q: string, country: string, key: string): Promise<Suggestion[]> {
  const ac = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST', signal: AbortSignal.timeout(4000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({ input: q, includedRegionCodes: [country.toLowerCase()], includedPrimaryTypes: ['street_address', 'premise', 'subpremise'] }),
  });
  if (!ac.ok) return [];
  const list: any[] = ((await ac.json()) as any).suggestions ?? [];
  const out: Suggestion[] = [];
  for (const sg of list.slice(0, 5)) {
    const id = sg.placePrediction?.placeId;
    if (!id) continue;
    const d = await fetch(`https://places.googleapis.com/v1/places/${id}`, { signal: AbortSignal.timeout(4000), headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'addressComponents,formattedAddress' } });
    if (!d.ok) continue;
    const place: any = await d.json();
    const comp = (t: string, short = false) => { const c = (place.addressComponents ?? []).find((x: any) => (x.types ?? []).includes(t)); return c ? (short ? c.shortText : c.longText) ?? '' : ''; };
    const line_1 = [comp('street_number'), comp('route')].filter(Boolean).join(' ') || sg.placePrediction?.structuredFormat?.mainText?.text || '';
    const city = comp('locality') || comp('sublocality') || comp('administrative_area_level_3') || '';
    out.push({ label: place.formattedAddress ?? sg.placePrediction?.text?.text ?? line_1, line_1, city, state: comp('administrative_area_level_1', true), postal_code: comp('postal_code'), country_alpha2: country });
  }
  return out;
}

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const country = (url.searchParams.get('country') ?? 'US').toUpperCase().slice(0, 2);
  if (q.length < 4) return json({ suggestions: [] });
  try {
    const suggestions = env.GOOGLE_PLACES_KEY ? await google(q, country, env.GOOGLE_PLACES_KEY) : country === 'US' ? await census(q) : [];
    return json({ suggestions, source: env.GOOGLE_PLACES_KEY ? 'google' : 'census' });
  } catch {
    return json({ suggestions: [] });
  }
};
