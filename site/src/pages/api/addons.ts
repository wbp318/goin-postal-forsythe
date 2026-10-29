export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { authenticate, CAN } from '../../lib/auth';
import { json } from '../../lib/validate';
import { effectiveAddons, addonsFromFile } from '../../lib/addons';
import { saveAddons, logAudit, type AddonRow } from '../../shipping/store';

// Add-ons and insurance terms, from the Add-ons section of /counter/rules. Same PIN rule as prices:
// the staff PIN can view, the owner PIN (when set) is needed to save.
//  get:  the catalog in force and where it comes from.
//  file: the seed file's catalog, to start from or reset to.
//  save: replace the whole catalog and the insurance terms, validated row by row.
const KINDS = ['box', 'packing', 'service'];

function clean(b: any): { insurance: { included_usd: number; per_100_usd: number; minimum_usd: number; max_declared_usd: number }; online_fee: { percent: number; flat: number }; sales_tax: { percent: number }; items: AddonRow[] } {
  const num = (v: unknown, what: string, min: number, max: number) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${what} must be a number between ${min} and ${max}`);
    return Math.round(n * 100) / 100;
  };
  const ins = b.insurance ?? {};
  const insurance = {
    included_usd: num(ins.included_usd, 'Carrier covers up to', 0, 10000),
    per_100_usd: num(ins.per_100_usd, 'Per $100', 0, 100),
    minimum_usd: num(ins.minimum_usd, 'Minimum fee', 0, 100),
    max_declared_usd: num(ins.max_declared_usd, 'Most we insure', 100, 100000),
  };
  const fee = b.online_fee ?? {};
  const online_fee = { percent: num(fee.percent ?? 0, 'Online fee percent', 0, 20), flat: num(fee.flat ?? 0, 'Online fee flat', 0, 20) };
  const sales_tax = { percent: num(b.sales_tax?.percent ?? 0, 'Sales tax percent', 0, 20) };
  const items: AddonRow[] = [];
  const seen = new Set<string>();
  for (const [i, r] of (Array.isArray(b.items) ? b.items : []).entries()) {
    const code = String(r.code ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20);
    const name = String(r.name ?? '').trim().slice(0, 80);
    if (!code || !name) { if (!code && !name) continue; throw new Error(`Row ${i + 1}: needs both a code and a name`); }
    if (!KINDS.includes(String(r.kind))) throw new Error(`${name}: kind must be box, packing or service`);
    if (seen.has(code)) throw new Error(`Code ${code} is used twice`);
    seen.add(code);
    items.push({ code, kind: r.kind, name, price: num(r.price, `${name}: price`, 0, 1000), active: r.active === false || r.active === 0 ? 0 : 1, sort: i });
  }
  return { insurance, online_fee, sales_tax, items };
}

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  const owner = CAN.prices(user);
  try {
    if (b.action === 'get') return json({ ...(await effectiveAddons(env)), owner });
    if (b.action === 'file') return json(addonsFromFile());
    if (b.action === 'save') {
      if (!owner) return json({ error: 'Saving add-ons needs the owner PIN' }, 403);
      const saved = await saveAddons(env, clean(b));
      await logAudit(env, user, 'addons.save', null, `${saved.items.length} items`);
      return json({ ok: true, ...saved, source: 'table', owner });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, /must be|needs both|used twice|kind must/.test(e.message ?? '') ? 400 : 500);
  }
};
