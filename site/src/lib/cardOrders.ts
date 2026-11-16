import type { Design, CardOptionLine } from './cards';

export interface CardOrder {
  id: string;             // CD-XXXXXX
  created_at: string;
  status: 'awaiting_payment' | 'paid' | 'sent' | 'printed' | 'picked_up';   // sent: out at a printer (T27)
  stripe_session_id?: string;
  paid_at?: string;
  customer: { name: string; email: string; phone: string };
  customer_id?: string;   // the signed-in account that ordered (Peter, Nov 15 2026); older orders have none
  quantity: number;
  price: number;          // the cards
  options?: CardOptionLine[]; // paid upsells: stock, finish, corners, rush (older orders have none)
  tax?: { percent: number; amount: number }; // sales tax on the cards and options (printed goods are taxable)
  fee?: { percent: number; flat: number; amount: number }; // online convenience fee
  total?: number;         // price plus options plus tax plus fee; older orders have only price
  design: Design;
  notes: string;
  printer?: { kind: 'shop' | 'trade' | 'local'; name: string; sent_at: string; by: string; ref?: string }; // where it went to be printed (T27)
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

// My orders on the account page (Peter, Nov 15 2026): each customer's card order numbers, newest first, kept
// beside the orders in KV. Orders placed before this have no entry and don't show there.
const MINE = (customerId: string) => `cardsof:${customerId}`;
export async function indexCardOrder(env: Env, customerId: string, id: string) {
  const ids: string[] = JSON.parse((await kv(env).get(MINE(customerId))) ?? '[]');
  if (!ids.includes(id)) ids.unshift(id);
  await kv(env).put(MINE(customerId), JSON.stringify(ids.slice(0, 100)), { expirationTtl: 60 * 60 * 24 * 180 });
}
export async function listCardOrdersFor(env: Env, customerId: string): Promise<CardOrder[]> {
  const ids: string[] = JSON.parse((await kv(env).get(MINE(customerId))) ?? '[]');
  const all = await Promise.all(ids.slice(0, 50).map((id) => getCardOrder(env, id)));
  // Only orders that still exist and really belong to this customer.
  return all.filter((o): o is CardOrder => !!o && o.customer_id === customerId);
}

