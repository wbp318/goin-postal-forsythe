// Orders live in Cloudflare KV. One record per quote the customer accepted.
import type { Address, Parcel, Rate, Label } from '../shipping/types';
import { upsertQuote } from '../shipping/store';

export type OrderStatus =
  | 'awaiting_payment'   // domestic: Stripe Checkout started, not paid
  | 'reserved'           // international: pay at the counter, label bought then
  | 'labeled'            // label bought, customer can print or show the QR
  | 'printed'            // staff printed it at the counter
  | 'voided'             // label bought, then voided by staff before it shipped
  | 'cancelled';         // quote dropped before any label was bought

export interface Order {
  id: string;             // pickup code shown to the customer, e.g. GP-7K3M9Q
  status: OrderStatus;
  created_at: string;
  email: string;          // blank for a walk-up who gave none
  phone?: string;         // customer's own number, only when they asked for text updates
  sms?: boolean;
  name?: string;          // walk-ups: who is standing at the counter
  source?: 'online' | 'counter'; // undefined means online, from before the queue existed
  kind?: 'ship' | 'return';      // return: the package travels from origin (the far end) back to us or to a local business
  emailed_at?: string;           // when the label was last emailed from the counter
  staff?: string;         // walk-ups: who typed it in
  voided_at?: string;
  cancelled_at?: string;
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
  // Mirror into the queue index so /counter/queue can list it. KV stays the record of truth.
  await upsertQuote(env, order).catch((e) => console.error('queue mirror failed', e));
}

export async function getOrder(env: Env, id: string): Promise<Order | null> {
  const raw = await kv(env).get(KEY(id.toUpperCase()));
  return raw ? (JSON.parse(raw) as Order) : null;
}
