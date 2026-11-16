export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { quote } from '../../lib/quote';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { store } from '../../data/store';
import { effectiveAddons, extrasOffer, signaturePrice, SIGNATURE_OFF } from '../../lib/addons';
import { advise, boxesFrom } from '../../lib/packing';
import { checkAddress } from '../../lib/address';
import { benchmarkFor } from '../../lib/benchmark';
import { logBenchmark } from '../../shipping/store';
import { directed, pickReturnRate, returnParcel } from '../../lib/options';
import { onlineLabelsOn } from '../../lib/siteSettings';
import { authenticate } from '../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    // The owners' switch (/counter/settings, Peter Nov 14 2026): Off means the website gives customers no
    // prices at all. Staff still quote at the counter: the Queue page sends its PIN.
    if (!(await onlineLabelsOn(env)) && !(await authenticate(env, b.pin))) return json({ error: 'Shipping is in the store for now. Bring your package to the counter.', offline: true }, 403);
    const parcel = parseParcel(b.parcel, { options: true });
    const cfg = await effectiveAddons(env);
    // Signature confirmation is charged from the add-on catalog; with the add-on switched off it is not offered.
    if (parcel.options?.signature && signaturePrice(cfg) == null) throw new Error(SIGNATURE_OFF);
    // "Return label only" swaps the addresses: the label runs from the receiver back to the sender.
    const { origin, destination } = directed(b.origin ? parseAddress(b.origin) : store.origin, parseAddress(b.destination), parcel.options);
    const { rates, demo, oversize } = await quote(env, origin, destination, parcel);
    // "Return label included": each rate carries the price of its return label (same service back where offered).
    const back = parcel.options?.return_label === 'included' ? (await quote(env, destination, origin, returnParcel(parcel))).rates : [];
    // Customers see service, price and days. Cost and provider stay server side.
    const visible = rates.map((r) => {
      const { id, carrier, service, total_charge, currency, min_days, max_days } = r;
      const ret = back.length ? pickReturnRate(r, back) : undefined;
      return { id, carrier, service, total_charge, currency, min_days, max_days, ...(ret ? { return_charge: ret.total_charge, return_service: ret.service } : {}) };
    });
    // Insurance fee for this declared value and the add-on catalog, so the page can show totals before buying.
    const extras = extrasOffer(cfg, parcel.value_usd);
    // Packing advice: what the carriers bill by size, which stocked box fits, whether a smaller one saves weight.
    const packing = advise(parcel, boxesFrom(cfg.items));
    // Address checks: errors stop the label later; warnings are shown now. PO boxes drop UPS and FedEx from the list.
    const address = checkAddress(destination);
    const offered = address.po_box || address.military ? visible.filter((r) => r.carrier === 'USPS') : visible;
    // The Pirate Ship benchmark (T26): shown beside the rates and logged for the weekly share.
    const benchmark = benchmarkFor(destination, parcel, rates);
    if (benchmark) await logBenchmark(env, { source: b.online ? 'online' : 'counter', zone: benchmark.zone, weight_lb: parcel.weight_lb, store_price: benchmark.store, benchmark: benchmark.pirate_ship }).catch(() => {});
    return json({ rates: offered, demo, oversize, extras, packing, address, benchmark });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
