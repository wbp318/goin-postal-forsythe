// One place that turns an address and parcel into the rates a customer sees.
// Carrier cost comes from the rates provider (Easyship, one API call for all four carriers);
// the retail price comes from the Rate Pro rules. Pages and APIs only ever call this.
import { getRates, type Address, type Parcel, type Rate } from './easyship';
import { retail } from './pricing';

export async function quote(env: Env, origin: Address, destination: Address, parcel: Parcel): Promise<{ rates: Rate[]; demo: boolean }> {
  const cost = await getRates(env.EASYSHIP_TOKEN, origin, destination, parcel);
  return { rates: retail(cost), demo: !env.EASYSHIP_TOKEN };
}
