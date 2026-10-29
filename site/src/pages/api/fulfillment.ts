export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json, parseAddress } from '../../lib/validate';
import { checkAddress } from '../../lib/address';
import { authenticate } from '../../lib/auth';
import { quote } from '../../lib/quote';
import { choose, discounted } from '../../lib/batch';
import { buyBatchRow } from '../../lib/batchBuy';
import { FEES, pickPackFee, parcelFor, shortages, pickList, storageFee } from '../../lib/fulfillment';
import { getAccount, listProducts, addProduct, updateProduct, moveStock, listFulfillmentOrders, getFulfillmentOrder, addFulfillmentOrder, updateFulfillmentOrder, addFee, listFees, logAudit, newFulfillmentCode, type ProductRow } from '../../shipping/store';

// Fulfillment at the store (T29), from /counter/fulfillment. Staff PIN, audited.
//   products { account_id } · product_add { account_id, sku, name, weight_lb, length_in, width_in, height_in, value_usd, bin }
//   product_update { id, ...fields } · receive { id, qty, boxes, note } (adds stock and the receiving fee)
//   orders { account_id } · order_add { account_id, reference, source, to, lines: [{sku, qty}], notes }
//   picklist { account_id } · ship { code, print } (buys the cheapest label, takes the stock, adds the pick-and-pack fee)
//   cancel { code, reason } · storage { account_id, period } (one storage fee for the month) · fees { account_id }
const num = (v: unknown, fb: number, min = 0, max = 1e6) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb; };

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'fee_rates') return json({ fees: FEES });
    if (['products', 'product_add', 'orders', 'order_add', 'picklist', 'storage', 'fees'].includes(b.action)) {
      const account = await getAccount(env, Number(b.account_id));
      if (!account || !account.active) return json({ error: 'Pick an open business account' }, 400);
      if (b.action === 'products') return json({ products: await listProducts(env, account.id), storage: storageFee(await listProducts(env, account.id)) });
      if (b.action === 'product_add') {
        const sku = String(b.sku ?? '').trim().toUpperCase().slice(0, 40), name = String(b.name ?? '').trim().slice(0, 80);
        if (!sku || !name) throw new Error('A SKU and a name are needed');
        if ((await listProducts(env, account.id)).some((p) => p.sku === sku)) throw new Error(`SKU ${sku} already exists on this account`);
        const p = await addProduct(env, { account_id: account.id, sku, name, weight_lb: num(b.weight_lb, 1, 0.01, 150), length_in: num(b.length_in, 6, 1, 108), width_in: num(b.width_in, 4, 1, 108), height_in: num(b.height_in, 2, 1, 108), value_usd: num(b.value_usd, 0, 0, 100000), bin: String(b.bin ?? '').trim().slice(0, 20) || null });
        await logAudit(env, user, 'product.add', String(p.id), `${account.business_name} ${sku} ${name}`);
        return json({ ok: true, product: p });
      }
      if (b.action === 'orders') return json({ orders: await listFulfillmentOrders(env, account.id, b.all === true) });
      if (b.action === 'order_add') {
        const to = parseAddress({ ...b.to, country_alpha2: b.to?.country_alpha2 || 'US' });
        const c = checkAddress(to); if (c.errors.length) throw new Error(c.errors[0]);
        const lines = (Array.isArray(b.lines) ? b.lines : []).map((l: any) => ({ sku: String(l.sku ?? '').trim().toUpperCase(), qty: Math.max(1, Math.floor(Number(l.qty) || 1)) })).filter((l: any) => l.sku).slice(0, 50);
        if (!lines.length) throw new Error('At least one line with a SKU is needed');
        const o = await addFulfillmentOrder(env, { code: newFulfillmentCode(), account_id: account.id, source: String(b.source ?? 'manual').slice(0, 20), reference: String(b.reference ?? '').trim().slice(0, 40) || null, to_json: JSON.stringify(to), lines_json: JSON.stringify(lines), notes: String(b.notes ?? '').trim().slice(0, 300) || null, by_name: user.name });
        await logAudit(env, user, 'fulfillment.order', o.code, `${account.business_name}${o.reference ? ` ref ${o.reference}` : ''}, ${lines.length} lines`);
        return json({ ok: true, order: o });
      }
      if (b.action === 'picklist') {
        const products = new Map((await listProducts(env, account.id)).map((p) => [p.sku, p]));
        const open = (await listFulfillmentOrders(env, account.id)).filter((o) => o.status === 'open');
        return json({ picklist: pickList(open.map((o) => ({ code: o.code, lines: JSON.parse(o.lines_json) })), products), orders: open.length });
      }
      if (b.action === 'storage') {
        const period = String(b.period ?? new Date().toISOString().slice(0, 7));
        if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Period must be YYYY-MM');
        if ((await listFees(env, account.id)).some((f) => f.kind === 'storage' && f.ref === period)) throw new Error(`Storage for ${period} is already on the account`);
        const s = storageFee(await listProducts(env, account.id));
        if (!s.bins) throw new Error('No stock on the shelf, nothing to charge');
        const f = await addFee(env, { account_id: account.id, kind: 'storage', qty: s.bins, unit_usd: FEES.storage_bin_month_usd, total: s.fee, ref: period, by_name: user.name });
        await logAudit(env, user, 'fulfillment.storage', String(f.id), `${account.business_name} ${period}: ${s.bins} bins $${s.fee.toFixed(2)}`);
        return json({ ok: true, fee: f });
      }
      if (b.action === 'fees') return json({ fees: await listFees(env, account.id) });
    }
    if (b.action === 'product_update' || b.action === 'receive') {
      const id = Number(b.id);
      const products = await listProducts(env, Number(b.account_id));
      const p = products.find((x) => x.id === id);
      if (!p) return json({ error: 'No such product on this account' }, 404);
      if (b.action === 'product_update') {
        const patch: Partial<ProductRow> = {};
        if (b.name != null) patch.name = String(b.name).trim().slice(0, 80);
        for (const k of ['weight_lb', 'length_in', 'width_in', 'height_in', 'value_usd'] as const) if (b[k] != null) patch[k] = num(b[k], p[k], 0, 100000);
        if (b.bin != null) patch.bin = String(b.bin).trim().slice(0, 20) || null;
        if (b.active != null) patch.active = b.active ? 1 : 0;
        const next = await updateProduct(env, id, patch);
        await logAudit(env, user, 'product.update', String(id), p.sku);
        return json({ ok: true, product: next });
      }
      const qty = Math.floor(Number(b.qty) || 0);
      if (!qty) throw new Error('How many came in?');
      const boxes = Math.max(0, Math.floor(Number(b.boxes) || 0));
      await moveStock(env, { product_id: p.id, account_id: p.account_id, qty, kind: qty > 0 ? 'received' : 'adjusted', ref: String(b.ref ?? '').trim().slice(0, 40) || null, by_name: user.name, note: String(b.note ?? '').trim().slice(0, 200) || null });
      let fee = null;
      if (boxes) fee = await addFee(env, { account_id: p.account_id, kind: 'receiving', qty: boxes, unit_usd: FEES.receiving_per_box_usd, total: Math.round(boxes * FEES.receiving_per_box_usd * 100) / 100, ref: p.sku, by_name: user.name });
      await logAudit(env, user, 'product.receive', String(p.id), `${p.sku} ${qty > 0 ? '+' : ''}${qty}${boxes ? `, ${boxes} boxes` : ''}`);
      return json({ ok: true, product: (await listProducts(env, p.account_id)).find((x) => x.id === id), fee });
    }
    if (b.action === 'ship' || b.action === 'cancel') {
      const o = await getFulfillmentOrder(env, String(b.code ?? ''));
      if (!o) return json({ error: 'No such order' }, 404);
      if (b.action === 'cancel') {
        if (o.status === 'shipped') throw new Error('Already shipped; void the label instead');
        const reason = String(b.reason ?? '').trim().slice(0, 200); if (!reason) throw new Error('A reason is needed');
        await updateFulfillmentOrder(env, o.code, { status: 'cancelled', notes: [o.notes, `Cancelled: ${reason}`].filter(Boolean).join('\n') });
        await logAudit(env, user, 'fulfillment.cancel', o.code, reason);
        return json({ ok: true });
      }
      if (o.status !== 'open') throw new Error(`This order is ${o.status}`);
      const account = await getAccount(env, o.account_id);
      if (!account || !account.active) throw new Error('The account is closed');
      const lines = JSON.parse(o.lines_json) as { sku: string; qty: number }[];
      const products = new Map((await listProducts(env, account.id)).map((p) => [p.sku, p]));
      const short = shortages(lines, products);
      if (short.length) throw new Error(`Not enough on the shelf: ${short.map((s) => `${s.sku} need ${s.need}, have ${s.have}`).join('; ')}`);
      const to = JSON.parse(o.to_json);
      const parcel = parcelFor(lines, products, lines.map((l) => `${l.qty}× ${products.get(l.sku)?.name ?? l.sku}`).join(', '));
      const { rates } = await quote(env, store.origin, to, parcel);
      const offered = rates.map((r) => discounted(r, account.discount_percent || 0));
      const rate = (b.rate_id ? offered.find((r) => r.id === b.rate_id) : null) ?? choose(offered, 'cheapest');
      if (!rate) throw new Error('No rate for this order');
      const bought = await buyBatchRow(env, { to, parcel, rate, reference: o.reference ?? o.code, account, batch: o.code, who: user, print: b.print !== false });
      if (!bought.id) throw new Error(bought.error ?? 'The label did not buy');
      for (const l of lines) await moveStock(env, { product_id: products.get(l.sku)!.id, account_id: account.id, qty: -l.qty, kind: 'picked', ref: o.code, by_name: user.name, note: null });
      const pp = pickPackFee(lines);
      const fee = await addFee(env, { account_id: account.id, kind: 'pick_pack', qty: pp.units, unit_usd: FEES.pick_pack_usd, total: pp.fee, ref: o.code, by_name: user.name });
      const next = await updateFulfillmentOrder(env, o.code, { status: 'shipped', shipment_id: bought.id, shipped_at: new Date().toISOString() });
      await logAudit(env, user, 'fulfillment.ship', o.code, `${account.business_name} -> ${bought.id}, ${rate.carrier} ${rate.service} $${(bought.price ?? 0).toFixed(2)}, pick and pack $${pp.fee.toFixed(2)}`);
      return json({ ok: true, order: next, shipment: bought, fee, parcel });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, /needed|Pick|already|enough|Missing|must be|ZIP|is |No rate|How many|nothing/.test(e.message ?? '') ? 400 : 500);
  }
};
import { store } from '../../data/store';
