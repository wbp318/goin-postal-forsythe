// Insurance and packaging add-ons: the lines that sit under the label on a quote, so the online total
// and the POS total are the same number. The catalog and the insurance terms live in the addons table,
// edited at /counter/rules; src/data/addons.json seeds a fresh install. Prices here are always computed
// on the server from the catalog, never taken from the browser.
import fileAddons from '../data/addons.json';
import { loadAddons, type AddonRow } from '../shipping/store';
import { insuranceFee, termsFor } from './insurance';

export interface Insurance { included_usd: number; per_100_usd: number; minimum_usd: number; max_declared_usd: number }
export interface OnlineFee { percent: number; flat: number }
export interface SalesTax { percent: number }
export interface AddonsConfig { insurance: Insurance; online_fee: OnlineFee; sales_tax: SalesTax; items: AddonRow[]; updated_at: string | null }
/** The code of the text-updates add-on; ticking "text me" on the ship page adds it. */
export const TEXT_UPDATES = 'text-updates';
export interface AddonLine { code: string; kind?: AddonRow['kind']; name: string; qty: number; unit_price: number; total: number }
/** Add-on kinds Louisiana taxes as goods: boxes and packing. Services (signature, text updates), insurance and postage are not taxed. */
export const TAXABLE_KINDS: AddonRow['kind'][] = ['box', 'packing'];
export interface Extras { addons: AddonLine[]; insurance?: { declared_usd: number; fee: number }; extras_total: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

export function addonsFromFile(): AddonsConfig {
  const f = fileAddons as { insurance: Insurance; online_fee?: OnlineFee; sales_tax?: SalesTax; items: { code: string; kind: string; name: string; price: number }[] };
  return { insurance: { ...f.insurance }, online_fee: { percent: f.online_fee?.percent ?? 0, flat: f.online_fee?.flat ?? 0 }, sales_tax: { percent: f.sales_tax?.percent ?? 0 }, items: f.items.map((i, sort) => ({ code: i.code, kind: i.kind as AddonRow['kind'], name: i.name, price: i.price, active: 1, sort })), updated_at: null };
}

/** The catalog in force: the table if anything was ever saved there, else the file. */
export async function effectiveAddons(env: Env): Promise<AddonsConfig & { source: 'table' | 'file' }> {
  const saved = await loadAddons(env);
  return saved ? { ...saved, source: 'table' } : { ...addonsFromFile(), source: 'file' };
}

/** Insurance fee for a declared value. Zero while the carrier's included cover is enough. Lives in lib/insurance.ts so the ship page can use it too. */
export { insuranceFee } from './insurance';

/** Price the extras a customer or staff member picked. Unknown or inactive codes are ignored, quantities capped at 20.
 *  `service` is the label's service: the carrier's included cover depends on it (none with Media Mail, lib/insurance.ts). */
export function priceExtras(cfg: AddonsConfig, picks: { code: string; qty: number }[] | undefined, declared: number, insure: boolean, service?: string): Extras {
  const addons: AddonLine[] = [];
  for (const p of picks ?? []) {
    const item = cfg.items.find((i) => i.active && i.code === String(p.code));
    const qty = Math.min(20, Math.max(0, Math.floor(Number(p.qty) || 0)));
    if (!item || !qty) continue;
    addons.push({ code: item.code, kind: item.kind, name: item.name, qty, unit_price: item.price, total: round2(item.price * qty) });
  }
  const ins = insure ? insuranceFee(termsFor(cfg.insurance, service), declared) : null;
  const insurance = ins && ins.fee > 0 ? { declared_usd: ins.declared_usd, fee: ins.fee } : undefined;
  const extras_total = round2(addons.reduce((a, l) => a + l.total, 0) + (insurance?.fee ?? 0));
  return { addons, insurance, extras_total };
}

/** The online convenience fee on a subtotal: a percent plus a flat amount, rounded to the cent. Zero when both are zero. Online orders only; the counter and the APIs never add it. */
export function onlineFee(cfg: AddonsConfig, subtotal: number): { percent: number; flat: number; amount: number } | undefined {
  const { percent, flat } = cfg.online_fee;
  if (!percent && !flat) return undefined;
  const amount = round2(Math.max(0, subtotal) * percent / 100 + flat);
  return amount > 0 ? { percent, flat, amount } : undefined;
}
/** Sales tax on a taxable amount at the configured rate, rounded to the cent. Nothing when the rate is zero or nothing is taxable. */
export function salesTax(cfg: AddonsConfig, taxable: number): { percent: number; amount: number } | undefined {
  const percent = cfg.sales_tax?.percent ?? 0;
  if (!percent || taxable <= 0) return undefined;
  const amount = round2(taxable * percent / 100);
  return amount > 0 ? { percent, amount } : undefined;
}
/** The taxable part of a shipment's extras: boxes and packing. Postage, insurance and services are never taxed. */
export function taxableExtras(extras: Extras): number {
  return round2(extras.addons.filter((l) => l.kind && TAXABLE_KINDS.includes(l.kind)).reduce((a, l) => a + l.total, 0));
}
/** What the returns drop-off page charges, from the catalog: printing a label from a phone, and a box. Zero when the item is missing or inactive. */
export const RETURN_LABEL = 'return-label';
export const RETURN_BOX = 'return-box';
export function returnPrices(cfg: AddonsConfig): { label: number; box: number } {
  const p = (code: string) => cfg.items.find((x) => x.active && x.code === code)?.price ?? 0;
  return { label: p(RETURN_LABEL), box: p(RETURN_BOX) };
}
/** The text-updates add-on's price when it is in the catalog and active. */
export function textUpdatesPrice(cfg: AddonsConfig): number | null {
  const i = cfg.items.find((x) => x.active && x.code === TEXT_UPDATES);
  return i ? i.price : null;
}
/** The code of the signature confirmation add-on; ticking Signature confirmation on the ship page charges it. */
export const SIGNATURE = 'signature';
export const SIGNATURE_OFF = 'Signature confirmation is not offered right now. Untick it, or ask us at the counter.';
/** The signature add-on's price when it is in the catalog and active. */
export function signaturePrice(cfg: AddonsConfig): number | null {
  const i = cfg.items.find((x) => x.active && x.code === SIGNATURE);
  return i ? i.price : null;
}
/** The add-on lines a ship page order is charged. Signature confirmation and text updates come from the customer's
 *  choices (one line each, at the catalog price), never from lines the browser sent; other lines count only with a
 *  quantity of one or more. Signature ticked while its add-on is off is refused, so it never goes on a label unpaid. */
export function shipPagePicks(cfg: AddonsConfig, sent: unknown, chosen: { signature: boolean; sms: boolean }): { code: string; qty: number }[] {
  const picks = (Array.isArray(sent) ? sent : [])
    .map((p: any) => ({ code: String(p?.code ?? ''), qty: Math.floor(Number(p?.qty)) }))
    .filter((p) => p.code !== TEXT_UPDATES && p.code !== SIGNATURE && p.qty >= 1);
  if (chosen.sms && textUpdatesPrice(cfg) != null) picks.push({ code: TEXT_UPDATES, qty: 1 });
  if (chosen.signature) {
    if (signaturePrice(cfg) == null) throw new Error(SIGNATURE_OFF);
    picks.push({ code: SIGNATURE, qty: 1 });
  }
  return picks;
}

/** What /api/rates hands the pages so they can show the fee and the catalog before anything is bought. */
export function extrasOffer(cfg: AddonsConfig, declared: number) {
  const ins = insuranceFee(cfg.insurance, declared);
  return {
    insurance: { ...ins, included_usd: cfg.insurance.included_usd, per_100_usd: cfg.insurance.per_100_usd, minimum_usd: cfg.insurance.minimum_usd, max_declared_usd: cfg.insurance.max_declared_usd },
    addons: cfg.items.filter((i) => i.active).sort((a, b) => a.sort - b.sort).map(({ code, kind, name, price }) => ({ code, kind, name, price })),
    online_fee: cfg.online_fee,
    sales_tax: cfg.sales_tax,
    text_updates_price: textUpdatesPrice(cfg),
  };
}
