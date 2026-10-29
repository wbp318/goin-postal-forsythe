// Fulfillment at the store (to-do T29, the ShipBob shape at Monroe scale): a business account keeps
// stock on the store's shelf; its orders come in with SKUs; staff pick, pack and ship them on the
// store's rates; the fees go on the account's statement. Pure helpers here; records in the store.
import fees from '../data/fulfillment.json';
import type { Parcel } from '../shipping/types';
import type { ProductRow } from '../shipping/store';

export const FEES = fees as { pick_pack_usd: number; extra_item_usd: number; receiving_per_box_usd: number; storage_bin_month_usd: number };
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface OrderLine { sku: string; qty: number }

/** The pick-and-pack fee for an order: one fee per order plus the extra-item fee for every unit past the first. */
export function pickPackFee(lines: OrderLine[]): { units: number; fee: number } {
  const units = lines.reduce((a, l) => a + Math.max(0, Math.floor(l.qty)), 0);
  return { units, fee: units ? r2(FEES.pick_pack_usd + FEES.extra_item_usd * Math.max(0, units - 1)) : 0 };
}

/** A parcel for the order from its products: weights summed, the biggest product's footprint plus a little for the box, a 4 oz floor. */
export function parcelFor(lines: OrderLine[], products: Map<string, ProductRow>, description = 'Merchandise'): Parcel {
  let weight = 0, length = 6, width = 4, height = 2, value = 0;
  for (const l of lines) {
    const p = products.get(l.sku); if (!p) continue;
    weight += p.weight_lb * l.qty; value += (p.value_usd ?? 0) * l.qty;
    length = Math.max(length, p.length_in); width = Math.max(width, p.width_in);
    height = Math.max(height, p.height_in) + (l.qty > 1 ? p.height_in * (l.qty - 1) : 0);
  }
  return { weight_lb: Math.max(0.25, r2(weight + 0.15)), length_in: Math.ceil(length + 1), width_in: Math.ceil(width + 1), height_in: Math.ceil(Math.min(height + 1, 60)), description: description.slice(0, 80), value_usd: Math.max(1, r2(value)) };
}

/** Which lines the shelf can fill, and which it cannot. */
export function shortages(lines: OrderLine[], products: Map<string, ProductRow>): { sku: string; need: number; have: number }[] {
  const out: { sku: string; need: number; have: number }[] = [];
  for (const l of lines) { const p = products.get(l.sku); const have = p?.on_hand ?? 0; if (!p || have < l.qty) out.push({ sku: l.sku, need: l.qty, have }); }
  return out;
}

/** The morning pick list: every open order's lines folded by SKU, with the bin, so one walk down the shelf fills them all. */
export function pickList(orders: { code: string; lines: OrderLine[] }[], products: Map<string, ProductRow>): { sku: string; name: string; bin: string | null; qty: number; orders: string[] }[] {
  const m = new Map<string, { sku: string; name: string; bin: string | null; qty: number; orders: string[] }>();
  for (const o of orders) for (const l of o.lines) {
    const p = products.get(l.sku);
    if (!m.has(l.sku)) m.set(l.sku, { sku: l.sku, name: p?.name ?? l.sku, bin: p?.bin ?? null, qty: 0, orders: [] });
    const e = m.get(l.sku)!; e.qty += l.qty; if (!e.orders.includes(o.code)) e.orders.push(o.code);
  }
  return [...m.values()].sort((a, b) => (a.bin ?? 'zzz').localeCompare(b.bin ?? 'zzz') || a.sku.localeCompare(b.sku));
}

/** Storage for a month: bins in use times the bin rate. A product with stock takes its bin; products sharing a bin count once. */
export function storageFee(products: ProductRow[]): { bins: number; fee: number } {
  const bins = new Set(products.filter((p) => p.on_hand > 0).map((p) => p.bin || `sku:${p.sku}`));
  return { bins: bins.size, fee: r2(bins.size * FEES.storage_bin_month_usd) };
}
