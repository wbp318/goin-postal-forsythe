export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json, parseParcel } from '../../lib/validate';
import { effectiveRules, rulesFromFile, applyRules } from '../../lib/pricing';
import { saveRules, type RuleRow } from '../../shipping/store';
import { getQuotes } from '../../shipping/engine';
import { store } from '../../data/store';

// Price rules from /counter/rules. Viewing needs the staff PIN; saving needs the owner PIN when one is
// set, otherwise the staff PIN.
//  get:     the rules in force and where they come from (table or the JSON file).
//  file:    the JSON file's rules, to start from or to reset to.
//  preview: a draft, applied to a real quote for a sample box, so the owner sees cost and price side by
//           side before saving. Nothing is stored.
//  save:    replace every rule. The draft is checked first; one bad row rejects the whole save.
const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL'];

function clean(b: any): { enabled: boolean; round_to_99: boolean; rules: RuleRow[] } {
  const num = (v: unknown, what: string, min: number, max: number): number | null => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${what} must be a number between ${min} and ${max}`);
    return Math.round(n * 100) / 100;
  };
  const rules: RuleRow[] = [];
  let defaults = 0;
  for (const [i, r] of (Array.isArray(b.rules) ? b.rules : []).entries()) {
    const scope = String(r.scope ?? '');
    if (!['default', 'carrier', 'service'].includes(scope)) throw new Error(`Row ${i + 1}: unknown scope`);
    const match = scope === 'default' ? null : String(r.match ?? '').trim();
    if (scope === 'carrier' && !CARRIERS.includes(match!)) throw new Error(`Row ${i + 1}: carrier must be one of ${CARRIERS.join(', ')}`);
    if (scope === 'service' && !match) throw new Error(`Row ${i + 1}: the service name is missing`);
    const label = scope === 'default' ? 'Default' : match!;
    const percent = num(r.percent, `${label}: percent`, -100, 500);
    const flat = num(r.flat, `${label}: flat fee`, -1000, 1000);
    const price = num(r.price, `${label}: fixed price`, 0.01, 10000);
    if (price != null && (percent != null || flat != null)) throw new Error(`${label}: use either a fixed price or percent and flat, not both`);
    if (scope === 'default') defaults++;
    rules.push({ scope: scope as RuleRow['scope'], match, percent, flat, price, active: r.active === false || r.active === 0 ? 0 : 1 });
  }
  if (defaults !== 1) throw new Error('There must be exactly one Default row');
  const seen = new Set<string>();
  for (const r of rules) {
    const k = `${r.scope}|${(r.match ?? '').toLowerCase()}`;
    if (seen.has(k)) throw new Error(`${r.match} is listed twice`);
    seen.add(k);
  }
  return { enabled: !!b.enabled, round_to_99: !!b.round_to_99, rules };
}

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const pin = String(b.pin ?? '');
  if (!env.COUNTER_PIN || (pin !== env.COUNTER_PIN && pin !== env.OWNER_PIN)) return json({ error: 'Wrong PIN' }, 403);
  const owner = env.OWNER_PIN ? pin === env.OWNER_PIN : true;
  try {
    if (b.action === 'get') return json({ ...(await effectiveRules(env)), owner, owner_pin_set: !!env.OWNER_PIN });
    if (b.action === 'file') return json(rulesFromFile());
    if (b.action === 'preview' || b.action === 'save') {
      const draft = clean(b);
      if (b.action === 'save') {
        if (!owner) return json({ error: 'Saving prices needs the owner PIN' }, 403);
        const saved = await saveRules(env, draft);
        return json({ ok: true, ...saved, source: 'table', owner, owner_pin_set: !!env.OWNER_PIN });
      }
      const zip = String(b.zip ?? '75201').replace(/\D/g, '').slice(0, 5) || '75201';
      const parcel = parseParcel(b.parcel ?? { weight_lb: 2, length_in: 10, width_in: 8, height_in: 4, description: 'Sample', value_usd: 25 });
      const dest = { contact_name: 'Sample', line_1: '1 Main St', city: 'Sample', state: 'TX', postal_code: zip, country_alpha2: 'US' };
      const q = await getQuotes(env, store.origin, dest, parcel);
      const current = await effectiveRules(env);
      const now = applyRules(current, q.rates), next = applyRules({ ...draft, updated_at: null }, q.rates);
      return json({ demo: q.demo, rows: q.rates.map((r, i) => ({ carrier: r.carrier, service: r.service, cost: r.cost, now: now[i].total_charge, next: next[i].total_charge })) });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, /must be|missing|twice|exactly one|unknown scope|either a fixed|one of/.test(e.message ?? '') ? 400 : 500);
  }
};
