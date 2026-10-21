import type { Design } from './cards';

export interface CardOrder {
  id: string;             // CD-XXXXXX
  created_at: string;
  status: 'awaiting_payment' | 'paid' | 'printed' | 'picked_up';
  stripe_session_id?: string;
  paid_at?: string;
  customer: { name: string; email: string; phone: string };
  quantity: number;
  price: number;
  design: Design;
  notes: string;
}

const KEY = (id: string) => `card:${id}`;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCardId() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return 'CD-' + Array.from(b, (x) => alphabet[x % alphabet.length]).join('');
}

const memory = new Map<string, string>();
function kv(env: Env) {
  if (env.ORDERS) return env.ORDERS;
  return { get: async (k: string) => memory.get(k) ?? null, put: async (k: string, v: string) => { memory.set(k, v); } } as unknown as KVNamespace;
}
export async function saveCardOrder(env: Env, o: CardOrder) {
  await kv(env).put(KEY(o.id), JSON.stringify(o), { expirationTtl: 60 * 60 * 24 * 180 });
}
export async function getCardOrder(env: Env, id: string): Promise<CardOrder | null> {
  const raw = await kv(env).get(KEY(id.toUpperCase()));
  return raw ? JSON.parse(raw) : null;
}
