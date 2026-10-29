export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { quote } from '../../lib/quote';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { store } from '../../data/store';
import { effectiveAddons, extrasOffer } from '../../lib/addons';
import { advise, boxesFrom } from '../../lib/packing';
import { checkAddress } from '../../lib/address';
import { benchmarkFor } from '../../lib/benchmark';
import { logBenchmark } from '../../shipping/store';

export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const origin = b.origin ? parseAddress(b.origin) : store.origin;
    const destination = parseAddress(b.destination);
    const parcel = parseParcel(b.parcel);
    const { rates, demo, oversize } = await quote(env, origin, destination, parcel);
    // Customers see service, price and days. Cost and provider stay server side.
    const visible = rates.map(({ id, carrier, service, total_charge, currency, min_days, max_days }) => ({ id, carrier, service, total_charge, currency, min_days, max_days }));
    // Insurance fee for this declared value and the add-on catalog, so the page can show totals before buying.
    const cfg = await effectiveAddons(env);
    const extras = extrasOffer(cfg, parcel.value_usd);
    // Packing advice: what the carriers bill by size, which stocked box fits, whether a smaller one saves weight.
    const packing = advise(parcel, boxesFrom(cfg.items));
    // Address checks: errors stop the label later; warnings are shown now. PO boxes drop UPS and FedEx from the list.
    const address = checkAddress(destination);
    const offered = address.po_box || address.military ? visible.filter((r) => r.carrier === 'USPS') : visible;
    // The Pirate Ship benchmark (T26): shown beside the rates and logged for the weekly share.
    const benchmark = benchmarkFor(destination, parcel, rates);
    if (benchmark) await logBenchmark(env, { source: b.origin ? 'counter' : 'online', zone: benchmark.zone, weight_lb: parcel.weight_lb, store_price: benchmark.store, benchmark: benchmark.pirate_ship }).catch(() => {});
    return json({ rates: offered, international: destination.country_alpha2 !== 'US', demo, oversize, extras, packing, address, benchmark });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
