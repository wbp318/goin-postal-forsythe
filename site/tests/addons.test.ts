// Insurance and add-on pricing: always on the server, from the catalog.
import { describe, it, expect } from 'vitest';
import { onlineFee, textUpdatesPrice, TEXT_UPDATES, addonsFromFile, insuranceFee, priceExtras, extrasOffer } from '../src/lib/addons';

const cfg = addonsFromFile();

describe('insurance', () => {
  it('is free up to the carrier cover, then per $100 with a minimum', () => {
    expect(insuranceFee(cfg.insurance, 30)).toMatchObject({ fee: 0, covered: true });
    expect(insuranceFee(cfg.insurance, 150)).toMatchObject({ fee: 2.75, covered: false }); // 1 x 1.25 < minimum
    expect(insuranceFee(cfg.insurance, 650)).toMatchObject({ fee: 7.5, covered: false });  // 6 x 1.25
  });
  it('caps the declared value', () => {
    expect(insuranceFee(cfg.insurance, 99999).declared_usd).toBe(cfg.insurance.max_declared_usd);
  });
});

describe('priceExtras', () => {
  it('prices picked add-ons, ignores unknown codes and zero quantities, caps at 20', () => {
    const x = priceExtras(cfg, [{ code: 'box-m', qty: 1 }, { code: 'pack', qty: 1 }, { code: 'nope', qty: 3 }, { code: 'fragile', qty: 0 }, { code: 'box-s', qty: 99 }], 650, true);
    expect(x.addons.map((l) => [l.code, l.qty])).toEqual([['box-m', 1], ['pack', 1], ['box-s', 20]]);
    expect(x.insurance).toEqual({ declared_usd: 650, fee: 7.5 });
    expect(x.extras_total).toBe(3.99 + 6 + 20 * 2.49 + 7.5);
  });
  it('no insurance line when not asked or when covered', () => {
    expect(priceExtras(cfg, [], 650, false).insurance).toBeUndefined();
    expect(priceExtras(cfg, [], 30, true).insurance).toBeUndefined();
  });
  it('skips inactive catalog items', () => {
    const c = { ...cfg, items: cfg.items.map((i) => (i.code === 'pack' ? { ...i, active: 0 } : i)) };
    expect(priceExtras(c, [{ code: 'pack', qty: 1 }], 1, false).addons).toEqual([]);
  });
});

describe('extrasOffer', () => {
  it('hands the page the fee and the active catalog in order', () => {
    const o = extrasOffer(cfg, 650);
    expect(o.insurance.fee).toBe(7.5);
    expect(o.addons[0]).toMatchObject({ code: 'box-s', kind: 'box' });
    expect(o.addons.every((a) => 'price' in a)).toBe(true);
  });

  it('online fee is percent plus flat on the subtotal, off when both are zero', () => {
    const cfg = addonsFromFile();
    expect(cfg.online_fee.percent).toBe(3.5);
    expect(onlineFee(cfg, 20)?.amount).toBe(0.7);
    expect(onlineFee({ ...cfg, online_fee: { percent: 0, flat: 1 } }, 20)?.amount).toBe(1);
    expect(onlineFee({ ...cfg, online_fee: { percent: 0, flat: 0 } }, 20)).toBeUndefined();
  });
  it('the text-updates add-on is in the seed catalog at 50 cents and prices like any other line', () => {
    const cfg = addonsFromFile();
    expect(textUpdatesPrice(cfg)).toBe(0.5);
    const x = priceExtras(cfg, [{ code: TEXT_UPDATES, qty: 1 }], 10, false);
    expect(x.extras_total).toBe(0.5);
    expect(textUpdatesPrice({ ...cfg, items: cfg.items.filter((i) => i.code !== TEXT_UPDATES) })).toBeNull();
  });
});
