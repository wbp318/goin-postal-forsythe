// Insurance and add-on pricing: always on the server, from the catalog.
import { describe, it, expect } from 'vitest';
import { onlineFee, returnPrices, salesTax, taxableExtras, textUpdatesPrice, TEXT_UPDATES, addonsFromFile, insuranceFee, priceExtras, extrasOffer, shipPagePicks, signaturePrice, SIGNATURE_OFF } from '../src/lib/addons';
import { includedFor, termsFor } from '../src/lib/insurance';

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

describe('sales tax', () => {
  it('seeds the Monroe combined rate and taxes only boxes and packing', () => {
    expect(cfg.sales_tax.percent).toBe(10.99);
    const x = priceExtras(cfg, [{ code: 'box-m', qty: 1 }, { code: 'pack', qty: 1 }, { code: 'signature', qty: 1 }, { code: TEXT_UPDATES, qty: 1 }], 650, true);
    expect(taxableExtras(x)).toBe(9.99); // 3.99 box + 6 packing; signature, text and insurance are not goods
    expect(salesTax(cfg, taxableExtras(x))).toEqual({ percent: 10.99, amount: 1.1 });
  });
  it('is nothing at a zero rate or with nothing taxable', () => {
    expect(salesTax({ ...cfg, sales_tax: { percent: 0 } }, 50)).toBeUndefined();
    expect(salesTax(cfg, 0)).toBeUndefined();
    expect(taxableExtras(priceExtras(cfg, [{ code: 'signature', qty: 2 }], 10, false))).toBe(0);
  });
  it('taxes a card order on the cards plus the options', () => {
    expect(salesTax(cfg, 67.99)).toEqual({ percent: 10.99, amount: 7.47 });
  });
  it('hands the page the rate', () => {
    expect(extrasOffer(cfg, 10).sales_tax).toEqual({ percent: 10.99 });
  });
});

describe('returnPrices', () => {
  it('reads the label-print and box prices from the catalog, zero when missing', () => {
    expect(returnPrices(cfg)).toEqual({ label: 2, box: 2 });
    expect(returnPrices({ ...cfg, items: cfg.items.filter((i) => i.code !== 'return-box') })).toEqual({ label: 2, box: 0 });
  });
});

describe('insurance cover by service', () => {
  it('Media Mail and Library Mail include none; other services the configured cover', () => {
    expect(includedFor(cfg.insurance, 'USPS Media Mail')).toBe(0);
    expect(includedFor(cfg.insurance, 'usps:LIBRARY_MAIL')).toBe(0);
    expect(includedFor(cfg.insurance, 'USPS Priority Mail')).toBe(cfg.insurance.included_usd);
    expect(includedFor(cfg.insurance, undefined)).toBe(cfg.insurance.included_usd);
    expect(termsFor(cfg.insurance, 'USPS Media Mail')).toEqual({ ...cfg.insurance, included_usd: 0 });
  });
  it('so $80 of books by Media Mail is charged for, while $80 by Priority Mail is covered', () => {
    expect(insuranceFee(termsFor(cfg.insurance, 'USPS Media Mail'), 80)).toMatchObject({ fee: 2.75, covered: false });
    expect(priceExtras(cfg, [], 80, true, 'USPS Media Mail').insurance).toEqual({ declared_usd: 80, fee: 2.75 });
    expect(priceExtras(cfg, [], 80, true, 'USPS Priority Mail').insurance).toBeUndefined();
  });
});

describe('shipPagePicks: what a ship page order is charged', () => {
  it('charges signature once, from the ticked option, at the catalog price', () => {
    const picks = shipPagePicks(cfg, [], { signature: true, sms: false });
    expect(picks).toEqual([{ code: 'signature', qty: 1 }]);
    expect(priceExtras(cfg, picks, 1, false).addons[0]).toMatchObject({ code: 'signature', total: signaturePrice(cfg)! });
  });
  it('ignores signature and text-update lines the browser sent, and lines with no quantity', () => {
    const sent = [{ code: 'signature', qty: 0 }, { code: 'signature', qty: 3 }, { code: TEXT_UPDATES, qty: 2 }, { code: 'box-m', qty: 0 }, { code: 'box-s', qty: 0.5 }, { code: 'pack', qty: 1 }, null];
    expect(shipPagePicks(cfg, sent, { signature: false, sms: false })).toEqual([{ code: 'pack', qty: 1 }]);
    expect(shipPagePicks(cfg, [{ code: 'signature', qty: 0 }], { signature: true, sms: true })).toEqual([{ code: TEXT_UPDATES, qty: 1 }, { code: 'signature', qty: 1 }]);
  });
  it('refuses signature while its add-on is switched off', () => {
    const off = { ...cfg, items: cfg.items.map((i) => (i.code === 'signature' ? { ...i, active: 0 } : i)) };
    expect(signaturePrice(off)).toBeNull();
    expect(() => shipPagePicks(off, [], { signature: true, sms: false })).toThrow(SIGNATURE_OFF);
    expect(shipPagePicks(off, [], { signature: false, sms: false })).toEqual([]);
  });
});
