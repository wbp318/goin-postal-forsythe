export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { parseBatch, rateBatch, batchTotal, resultsCsv, discounted, choose, MAX_ROWS, type Pick } from '../../lib/batch';
import { buyBatchRow, type BuyResult } from '../../lib/batchBuy';
import { getAccount, logAudit } from '../../shipping/store';
import { quote } from '../../lib/quote';
import { store } from '../../data/store';
import { parseAddress, parseParcel } from '../../lib/validate';

// Batch shipping from /counter/batch (T11). Staff PIN. An account's CSV is checked and rated, then
// every good row is bought, billed to the account and queued for the counter printer in file order.
//   rate: { pin, account_id, csv, defaults: { weight_lb, length_in, width_in, height_in, value_usd? }, pick: 'cheapest' | 'fastest' | 'USPS Ground Advantage' }
//   buy:  { pin, account_id, rows: [{ line, reference, to, parcel, rate_id }], print: true, batch?: 'B-...' }
const pickOf = (v: unknown): Pick => (v === 'fastest' ? 'fastest' : !v || v === 'cheapest' ? 'cheapest' : { service: String(v) });

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    const account = await getAccount(env, Number(b.account_id));
    if (!account || !account.active) return json({ error: 'Pick an open business account: batches are billed to it' }, 400);
    if (b.action === 'rate') {
      const csv = String(b.csv ?? '');
      if (csv.length > 2_000_000) return json({ error: 'That file is too big; split it' }, 400);
      const d = b.defaults ?? {};
      const parsed = parseBatch(csv, { weight_lb: Number(d.weight_lb) || 1, length_in: Number(d.length_in) || 10, width_in: Number(d.width_in) || 8, height_in: Number(d.height_in) || 4, value_usd: Number(d.value_usd) || undefined, description: String(d.description ?? '').slice(0, 80) || undefined });
      if (!parsed.rows.length) return json({ error: parsed.format === 'unknown' ? 'No address columns found. Expected address1, city, state, zip, or a Shopify or Etsy orders export' : 'No rows with an address in that file' }, 400);
      const rows = await rateBatch(env, parsed.rows, pickOf(b.pick), account.discount_percent || 0);
      return json({ format: parsed.format, headers: parsed.headers, skipped: parsed.skipped, max_rows: MAX_ROWS, rows, total: batchTotal(rows), ready: rows.filter((r) => r.chosen && !r.errors.length).length });
    }
    if (b.action === 'buy') {
      const batch = String(b.batch ?? '').trim().slice(0, 20) || `B-${Date.now().toString(36).toUpperCase()}`;
      const list: any[] = Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS) : [];
      if (!list.length) return json({ error: 'No rows to buy' }, 400);
      const results: BuyResult[] = [];
      for (const r of list) {
        try {
          const to = parseAddress(r.to), parcel = parseParcel(r.parcel);
          const { rates } = await quote(env, store.origin, to, parcel);
          const offered = rates.map((x) => discounted(x, account.discount_percent || 0));
          const rate = offered.find((x) => x.id === r.rate_id) ?? choose(offered, 'cheapest');
          if (!rate) throw new Error('No rate for this row');
          results.push(await buyBatchRow(env, { to, parcel, rate, reference: String(r.reference ?? '').slice(0, 40), account, batch, who: user, print: b.print === true || b.print === 'on' }));
        } catch (e: any) {
          results.push({ line: Number(r.line) || 0, reference: String(r.reference ?? ''), id: null, carrier: null, service: null, tracking_number: null, price: null, label_url: null, error: e.message });
        }
      }
      const bought = results.filter((x) => x.id);
      await logAudit(env, user, 'batch.buy', batch, `${account.business_name}: ${bought.length} of ${results.length} labels, $${bought.reduce((a, x) => a + (x.price ?? 0), 0).toFixed(2)}`);
      return json({ batch, results, bought: bought.length, failed: results.length - bought.length, total: Math.round(bought.reduce((a, x) => a + (x.price ?? 0), 0) * 100) / 100, csv: resultsCsv(results), agent: !!env.PRINTER_KEY });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
