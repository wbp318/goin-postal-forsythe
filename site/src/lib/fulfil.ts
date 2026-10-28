// Shared "buy the label now" step, used after Stripe pays (domestic) or after
// staff ring a reserved order up on the POS (international). Routes to whichever
// carrier adapter produced the chosen rate, then records the shipment in PeterShip's
// own store so tracking, the printer agent and the reports can see it.
import { buyLabel } from '../shipping/engine';
import { recordShipment, recordOrderAddons } from '../shipping/store';
import { saveOrder, type Order } from './orders';

export async function fulfil(env: Env, order: Order, paidVia: 'stripe' | 'pos' | 'mock' = order.international ? 'pos' : env.STRIPE_SECRET_KEY ? 'stripe' : 'mock'): Promise<Order> {
  if (order.status === 'labeled' || order.status === 'printed') return order; // idempotent
  const label = await buyLabel(env, order.origin, order.destination, order.parcel, order.rate.id, { qr: true, zpl: true });
  const next: Order = { ...order, status: 'labeled', paid_at: order.paid_at ?? new Date().toISOString(), label };
  await saveOrder(env, next);
  await recordShipment(env, next, label, paidVia).catch((e) => console.error('shipment record failed', e));
  await recordOrderAddons(env, next).catch((e) => console.error('add-on record failed', e));
  return next;
}
