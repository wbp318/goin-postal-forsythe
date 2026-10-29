// Card order pricing: quantity tiers plus the upsells, always from the server's table.
import { describe, it, expect } from 'vitest';
import { priceCards, priceCardOptions, chosenOptions, CARD_OPTIONS, OPTION_GROUPS, PRICES, sanitizeDesign } from '../src/lib/cards';

describe('card options', () => {
  it('every group has exactly one free default', () => {
    for (const g of OPTION_GROUPS) {
      const defaults = CARD_OPTIONS.filter((o) => o.group === g && o.default);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].price).toBe(0);
    }
  });
  it('prices the picks, one per group, and ignores unknown codes', () => {
    const r = priceCardOptions({ stock: 'linen', finish: 'gloss', corners: 'nope', speed: 'rush', bogus: 'thick' });
    expect(r.lines.map((l) => [l.code, l.price])).toEqual([['linen', 8], ['gloss', 4], ['rush', 10]]);
    expect(r.total).toBe(22);
    expect(r.chosen).toEqual({ stock: 'linen', finish: 'gloss', corners: 'square', speed: 'rush' });
  });
  it('no picks means no lines', () => {
    expect(priceCardOptions(undefined)).toMatchObject({ lines: [], total: 0 });
    expect(priceCardOptions({ stock: 'standard', finish: 'matte' }).total).toBe(0);
  });
  it('a code from another group does not count', () => {
    expect(priceCardOptions({ stock: 'rush' }).lines).toEqual([]);
  });
});

describe('priceCards', () => {
  it('adds the options to the quantity price', () => {
    const r = priceCards(250, { stock: 'thick', corners: 'rounded' });
    expect(r.price).toBe(PRICES[250]);
    expect(r.subtotal).toBe(PRICES[250] + 11);
    expect(r.options.map((o) => o.code)).toEqual(['thick', 'rounded']);
  });
  it('rejects a quantity that is not a tier', () => {
    expect(() => priceCards(300)).toThrow('Pick a quantity');
  });
});

describe('chosenOptions', () => {
  it('fills defaults for groups with no paid line, including old orders with no lines', () => {
    expect(chosenOptions(undefined).map((o) => o.code)).toEqual(['standard', 'matte', 'square', 'normal']);
    expect(chosenOptions([{ group: 'finish', code: 'softtouch', name: 'Soft touch', price: 6 }]).map((o) => o.code)).toEqual(['standard', 'softtouch', 'square', 'normal']);
  });
});

describe('sanitizeDesign', () => {
  it('drops images that are not data URLs and clamps text', () => {
    const d = sanitizeDesign({ template: 'band', font: 'bad', front: { bg: 'red', elements: [
      { type: 'image', href: 'https://evil/x.png', x: 0, y: 0, w: 10, h: 10 },
      { type: 'text', text: 'x'.repeat(500), size: 9999, color: '#zzzzzz', align: 'left', x: 0, y: 0, w: 10 },
    ] } });
    expect(d.template).toBe('band');
    expect(d.font).toBe('sans');
    expect(d.front.bg).toBe('#ffffff');
    expect(d.front.elements).toHaveLength(1);
    const t = d.front.elements[0] as any;
    expect(t.text).toHaveLength(300); expect(t.size).toBe(300); expect(t.color).toBe('#17202d'); expect(t.align).toBe('start');
  });
});
