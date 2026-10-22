// Shared "buy the label now" step, used after Stripe pays (domestic) or after
// staff ring a reserved order up on the POS (international). Routes to whichever
// carrier adapter produced the chosen rate.
import { buyLabel } from '../shipping/engine';
import { saveOrder, type Order } from './orders';

export async function fulfil(env: Env, order: Order): Promise<Order> {
  if (order.status === 'labeled' || order.status === 'printed') return order; // idempotent
  const label = await buyLabel(env, order.origin, order.destination, order.parcel, order.rate.id, { qr: true, zpl: false });
  const next: Order = { ...order, status: 'labeled', paid_at: order.paid_at ?? new Date().toISOString(), label };
  await saveOrder(env, next);
  return next;
}
