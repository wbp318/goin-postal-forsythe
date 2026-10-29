// Fulfillment at the store (T29): fees, the parcel from products, shortages, the pick list, the records, fees on the statement.
import { describe, it, expect } from 'vitest';
import { pickPackFee, parcelFor, shortages, pickList, storageFee, FEES } from '../src/lib/fulfillment';
import * as store from '../src/shipping/store';

const env = {} as any;

describe('fulfillment helpers', () => {
  const p = (sku: string, over: Partial<store.ProductRow> = {}): store.ProductRow => ({ id: 1, account_id: 1, sku, name: sku, weight_lb: 1, length_in: 6, width_in: 4, height_in: 2, value_usd: 10, on_hand: 5, bin: 'A1', active: 1, created_at: '', updated_at: '', ...over });
  it('pick and pack is one fee plus extra items', () => {
    expect(pickPackFee([{ sku: 'A', qty: 1 }])).toEqual({ units: 1, fee: FEES.pick_pack_usd });
    expect(pickPackFee([{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }]).fee).toBe(FEES.pick_pack_usd + 2 * FEES.extra_item_usd);
    expect(pickPackFee([]).fee).toBe(0);
  });
  it('the parcel sums weight, takes the biggest footprint, stacks height, floors at 4 oz', () => {
    const m = new Map([['A', p('A')], ['B', p('B', { weight_lb: 0.5, length_in: 10, height_in: 1 })]]);
    const x = parcelFor([{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }], m);
    expect(x.weight_lb).toBe(2.65); expect(x.length_in).toBe(11); expect(x.height_in).toBe(5); expect(x.value_usd).toBe(30);
    expect(parcelFor([], m).weight_lb).toBe(0.25);
  });
  it('shortages and the pick list by bin', () => {
    const m = new Map([['A', p('A', { on_hand: 1 })], ['B', p('B', { bin: 'B2' })]]);
    expect(shortages([{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }, { sku: 'Z', qty: 1 }], m)).toEqual([{ sku: 'A', need: 2, have: 1 }, { sku: 'Z', need: 1, have: 0 }]);
    const pl = pickList([{ code: 'FO-1', lines: [{ sku: 'B', qty: 1 }, { sku: 'A', qty: 2 }] }, { code: 'FO-2', lines: [{ sku: 'A', qty: 1 }] }], m);
    expect(pl.map((r) => [r.sku, r.qty, r.orders.length])).toEqual([['A', 3, 2], ['B', 1, 1]]);
    expect(storageFee([p('A'), p('B', { bin: 'A1' }), p('C', { on_hand: 0, bin: 'C3' })])).toEqual({ bins: 1, fee: FEES.storage_bin_month_usd });
  });
});

describe('fulfillment records', () => {
  it('products, stock moves that never go negative, orders, fees that ride on the statement', async () => {
    const cid = (await store.upsertCustomer(env, { name: 'Ful Co', email: 'ful@example.com' }))!;
    const acc = await store.addAccount(env, { customer_id: cid, business_name: 'Ful Co', discount_percent: 0, notes: '' });
    const a = await store.addProduct(env, { account_id: acc.id, sku: 'CANDLE', name: 'Candle', weight_lb: 1, length_in: 4, width_in: 4, height_in: 4, value_usd: 12, bin: 'A1' });
    await store.moveStock(env, { product_id: a.id, account_id: acc.id, qty: 10, kind: 'received', ref: null, by_name: 'T', note: null });
    await store.moveStock(env, { product_id: a.id, account_id: acc.id, qty: -3, kind: 'picked', ref: 'FO-X', by_name: 'T', note: null });
    await store.moveStock(env, { product_id: a.id, account_id: acc.id, qty: -50, kind: 'adjusted', ref: null, by_name: 'T', note: 'oops' });
    expect((await store.listProducts(env, acc.id))[0].on_hand).toBe(0);
    expect((await store.updateProduct(env, a.id, { bin: 'B2', name: 'Soy candle' }))?.bin).toBe('B2');
    const o = await store.addFulfillmentOrder(env, { code: 'FO-TEST1', account_id: acc.id, source: 'manual', reference: '#9', to_json: '{}', lines_json: '[{"sku":"CANDLE","qty":1}]', notes: null, by_name: 'T' });
    expect((await store.listFulfillmentOrders(env, acc.id)).map((x) => x.code)).toEqual([o.code]);
    await store.updateFulfillmentOrder(env, o.code, { status: 'shipped', shipment_id: 'GP-1', shipped_at: '2026-10-29T00:00:00Z' });
    expect(await store.listFulfillmentOrders(env, acc.id)).toEqual([]);
    expect((await store.listFulfillmentOrders(env, acc.id, true))[0].status).toBe('shipped');
    const f = await store.addFee(env, { account_id: acc.id, kind: 'pick_pack', qty: 1, unit_usd: 2, total: 2, ref: o.code, by_name: 'T' });
    const lines = await store.accountOpenFees(env, acc.id);
    expect(lines).toHaveLength(1); expect(lines[0].id).toBe(`FEE-${f.id}`); expect(lines[0].total).toBe(2);
    await store.saveStatement(env, { account_id: acc.id, period: '2026-10', total: 2, lines, stripe_invoice_id: null, stripe_invoice_url: null });
    expect(await store.accountOpenFees(env, acc.id)).toEqual([]);
  });
});
