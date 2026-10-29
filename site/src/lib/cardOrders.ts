import type { Design, CardOptionLine } from './cards';

export interface CardOrder {
  id: string;             // CD-XXXXXX
  created_at: string;
  status: 'awaiting_payment' | 'paid' | 'printed' | 'picked_up';
  stripe_session_id?: string;
  paid_at?: string;
  customer: { name: string; email: string; phone: string };
  quantity: number;
  price: number;          // the cards
  options?: CardOptionLine[]; // paid upsells: stock, finish, corners, rush (older orders have none)
  tax?: { percent: number; amount: number }; // sales tax on the cards and options (printed goods are taxable)
  fee?: { percent: number; flat: number; amount: number }; // online convenience fee
  total?: number;         // price plus options plus tax plus fee; older orders have only price
  design: Design;
  notes: string;
}

export const cardTotal = (o: CardOrder) => o.total ?? o.price;

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
