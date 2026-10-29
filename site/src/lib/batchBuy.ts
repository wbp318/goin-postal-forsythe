// One row of a batch bought as a shipment: the same path as a single account label through the
// public API or the counter, so the shipment, billing, audit and print queue all see it. Shared by
// /api/batch (staff) and /api/v1/batches (the account's own software).
import type { Address, Parcel, Rate } from '../shipping/types';
import { newOrderId, saveOrder, type Order } from './orders';
import { fulfil } from './fulfil';
import { effectiveAddons, priceExtras, salesTax, taxableExtras } from './addons';
import { billShipmentToAccount, logAudit, queuePrint, type AccountRow } from '../shipping/store';
import { store } from '../data/store';

export interface BuyResult { line: number; reference: string; id: string | null; carrier: string | null; service: string | null; tracking_number: string | null; price: number | null; label_url: string | null; error: string | null }

export async function buyBatchRow(env: Env, x: { to: Address; parcel: Parcel; rate: Rate; reference: string; account: AccountRow; batch: string; who: { id: number | null; name: string }; print: boolean; insure?: boolean; line?: number }): Promise<BuyResult> {
  const cfg = await effectiveAddons(env);
  const extras = priceExtras(cfg, [], x.parcel.value_usd, !!x.insure);
  const tax = salesTax(cfg, taxableExtras(extras));
  const order: Order = {
    id: newOrderId(), status: 'reserved', created_at: new Date().toISOString(), email: '', name: x.account.business_name,
    source: 'counter', staff: x.who.name.slice(0, 20), origin: store.origin, destination: x.to, parcel: x.parcel, rate: x.rate, international: false, kind: 'ship',
    insurance: extras.insurance, tax, total: Math.round((x.rate.total_charge + extras.extras_total + (tax?.amount ?? 0)) * 100) / 100,
    account_id: x.account.id, account_name: x.account.business_name, discount_percent: x.account.discount_percent || undefined,
    batch: x.batch, reference: x.reference || undefined,
  };
  await saveOrder(env, order);
  const done = await fulfil(env, { ...order, paid_at: new Date().toISOString() }, 'account');
  await billShipmentToAccount(env, done.id, x.account.id);
  await logAudit(env, x.who, 'label.buy', done.id, `batch ${x.batch}${x.reference ? ` ref ${x.reference}` : ''}, ${x.rate.carrier} ${x.rate.service} $${(done.total ?? x.rate.total_charge).toFixed(2)}, billed to ${x.account.business_name}`);
  const l = done.label;
  if (x.print && l) {
    const pdf = l.label_url && l.label_url.startsWith('/') ? `${env.SITE_URL}${l.label_url}` : l.label_url;
    const job = l.label_zpl ? { kind: 'label_zpl' as const, payload: l.label_zpl } : pdf ? { kind: 'label_pdf' as const, payload: pdf } : null;
    if (job) await queuePrint(env, { shipment_id: done.id, ...job, printer: 'counter' });
  }
  return { line: x.line ?? 0, reference: x.reference, id: done.id, carrier: x.rate.carrier, service: x.rate.service, tracking_number: l?.tracking_number ?? null, price: done.total ?? x.rate.total_charge, label_url: l?.label_url ? (l.label_url.startsWith('/') ? `${env.SITE_URL}${l.label_url}` : l.label_url) : null, error: null };
}
