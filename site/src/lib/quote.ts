// One place that turns an address and parcel into the rates a customer sees.
// The shipping client's rating engine asks every configured carrier, fills gaps from the
// single-call fallback, applies the Rate Pro retail rules and caches the answer.
import { getQuotes } from '../shipping/engine';
import type { Address, Parcel, Rate } from '../shipping/types';

export async function quote(env: Env, origin: Address, destination: Address, parcel: Parcel): Promise<{ rates: Rate[]; demo: boolean; oversize: boolean }> {
  const q = await getQuotes(env, origin, destination, parcel);
  if (q.errors.length) console.warn('rate errors', JSON.stringify(q.errors));
  return { rates: q.rates, demo: q.demo, oversize: q.oversize };
}
