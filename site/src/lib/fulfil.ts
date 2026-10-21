// Shared "buy the label now" step, used after Stripe pays (domestic) or after
// staff mark a reserved order paid at the counter (international).
import { buyLabel } from './easyship';
import { saveOrder, type Order } from './orders';

export async function fulfil(env: Env, order: Order): Promise<Order> {
  if (order.status === 'labeled' || order.status === 'printed') return order; // idempotent
  const label = await buyLabel(env.EASYSHIP_TOKEN, order.origin, order.destination, order.parcel, order.rate.courier_service_id, true);
  const next: Order = { ...order, status: 'labeled', paid_at: order.paid_at ?? new Date().toISOString(), label };
  await saveOrder(env, next);
  return next;
}
