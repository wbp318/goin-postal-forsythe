// Shared "buy the label now" step, used after Stripe pays (domestic) or after
// staff ring a reserved order up on the POS (international). Routes to whichever
// carrier adapter produced the chosen rate, then records the shipment in PeterShip's
// own store so tracking, the printer agent and the reports can see it.
import { buyLabel, voidLabel } from '../shipping/engine';
import { recordShipment, recordOrderAddons, setShipmentStatus, logAudit } from '../shipping/store';
import { saveOrder, type Order } from './orders';
import { returnParcel } from './options';

/** The return label is a PDF: every adapter then fills label_url (ZPL fills only label_zpl). */
export const RETURN_LABEL_FORMAT = { qr: true, zpl: false } as const;

export async function fulfil(env: Env, order: Order, paidVia: 'stripe' | 'pos' | 'mock' | 'account' = order.international ? 'pos' : env.STRIPE_SECRET_KEY ? 'stripe' : 'mock'): Promise<Order> {
  if (order.status === 'labeled' || order.status === 'printed') return order; // idempotent
  // Insurance the customer paid for goes on the label as the carrier's own insurance (Peter, Nov 14 2026).
  const parcel = order.insurance?.declared_usd ? { ...order.parcel, insured_usd: order.insurance.declared_usd } : order.parcel;
  const label = await buyLabel(env, order.origin, order.destination, parcel, order.rate.id, { qr: true, zpl: true });
  // "Return label included": the second label runs from the destination back to the origin, without the
  // outgoing extras (no signature, no insurance). Recorded as its own shipment, code + "-R".
  // It is bought as a PDF (label_url), not ZPL: the customer downloads it, the counter opens, prints or emails it,
  // and it usually travels to the receiver rather than through the store's thermal printer.
  // If it fails, the paid outgoing label still stands: the counter page shows the return label as not bought yet.
  let return_label = order.return_label;
  if (order.return_rate && !return_label) {
    try { return_label = await buyLabel(env, order.destination, order.origin, returnParcel(order.parcel), order.return_rate.id, RETURN_LABEL_FORMAT); }
    catch (e) { console.error('return label failed', order.id, e); }
  }
  const next: Order = { ...order, status: 'labeled', paid_at: order.paid_at ?? new Date().toISOString(), label, ...(return_label ? { return_label } : {}) };
  await saveOrder(env, next);
  await recordShipment(env, next, label, paidVia).catch((e) => console.error('shipment record failed', e));
  if (return_label && order.return_rate) await recordShipment(env, { ...next, id: `${next.id}-R`, origin: next.destination, destination: next.origin, parcel: returnParcel(next.parcel), rate: order.return_rate, kind: 'return' }, return_label, paidVia).catch((e) => console.error('return shipment record failed', e));
  await recordOrderAddons(env, next).catch((e) => console.error('add-on record failed', e));
  return next;
}

/** "Return label included": when staff void the order, its return label is voided with the carrier too, shipment
 *  code + "-R" is marked voided like the main one, and both outcomes go to the audit log. Call it after the outgoing
 *  label is voided. A return label that cannot be voided does not undo that: the warning tells staff to do it by hand. */
export async function voidReturnLabel(env: Env, order: Order, user: { id: number | null; name: string }, reason: string): Promise<string | undefined> {
  const r = order.return_label;
  if (!r) return undefined;
  const id = `${order.id}-R`;
  try {
    await voidLabel(env, r.id);
    await setShipmentStatus(env, id, 'voided');
    await logAudit(env, user, 'label.void', id, `${reason}. Return label, ${order.return_rate?.carrier ?? r.carrier} ${r.tracking_number ?? ''}`.trim());
    return undefined;
  } catch (e: any) {
    await logAudit(env, user, 'label.void.failed', id, `${reason}. Return label not voided: ${e?.message ?? e}`);
    return `The label is voided, but its return label could not be (${e?.message ?? e}). Void the return label with the carrier by hand.`;
  }
}

const PDF_DATA = 'data:application/pdf;base64,';
/** How a return label travels in the counter's "Email label": a PDF the carrier sent back inline goes as an
 *  attachment (a data: link does not open from a mail program); a hosted PDF goes as its link. */
export function returnLabelForEmail(order: Order, siteUrl: string): { line: string | null; attachment?: { filename: string; content: string } } {
  const u = order.return_label?.label_url;
  if (!u) return { line: null };
  const filename = `${order.id}-return-label.pdf`;
  if (u.startsWith(PDF_DATA)) return { line: `Return label, so the receiver can send it back: attached (${filename}).`, attachment: { filename, content: u.slice(PDF_DATA.length) } };
  if (u.startsWith('data:')) return { line: null };
  return { line: `Return label, so the receiver can send it back: ${u.startsWith('/') ? `${siteUrl}${u}` : u}` };
}
