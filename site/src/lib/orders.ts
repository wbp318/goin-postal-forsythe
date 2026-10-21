// Orders live in Cloudflare KV. One record per quote the customer accepted.
import type { Address, Parcel, Rate, Label } from './easyship';

export type OrderStatus =
  | 'awaiting_payment'   // domestic: Stripe Checkout started, not paid
  | 'reserved'           // international: pay at the counter, label bought then
  | 'labeled'            // label bought, customer can print or show the QR
  | 'printed';           // staff printed it at the counter

export interface Order {
  id: string;             // pickup code shown to the customer, e.g. GP-7K3M9Q
  status: OrderStatus;
  created_at: string;
  email: string;
  origin: Address;
  destination: Address;
  parcel: Parcel;
  rate: Rate;
  international: boolean;
  stripe_session_id?: string;
  paid_at?: string;
  label?: Label;
  printed_at?: string;
}

const KEY = (id: string) => `order:${id}`;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, easy to read aloud

export function newOrderId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'GP-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// Local dev without a KV id still works thanks to an in-memory fallback.
const memory = new Map<string, string>();
function kv(env: Env) {
  if (env.ORDERS) return env.ORDERS;
  return {
    get: async (k: string) => memory.get(k) ?? null,
    put: async (k: string, v: string) => { memory.set(k, v); },
  } as unknown as KVNamespace;
}

export async function saveOrder(env: Env, order: Order) {
  await kv(env).put(KEY(order.id), JSON.stringify(order), { expirationTtl: 60 * 60 * 24 * 90 });
}

export async function getOrder(env: Env, id: string): Promise<Order | null> {
  const raw = await kv(env).get(KEY(id.toUpperCase()));
  return raw ? (JSON.parse(raw) as Order) : null;
}
