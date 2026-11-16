import { describe, it, expect } from 'vitest';
import { BUSINESS_TYPES, businessType, fromPrice, typesValid } from '../src/lib/cardShop';
import { PRICES, priceCards, sanitizeDesign, CARD_W, CARD_H } from '../src/lib/cards';

// The business card shop page (Peter, Nov 14 2026): its prices come from the checkout's own table.
describe('card shop', () => {
  it('every business type uses a real layout and color scheme, with its own sample details', () => {
    expect(typesValid()).toBe(true);
    expect(new Set(BUSINESS_TYPES.map((b) => b.id)).size).toBe(BUSINESS_TYPES.length);
    for (const b of BUSINESS_TYPES) expect(b.sample.company.length).toBeGreaterThan(0);
    expect(businessType('auto')?.name).toBe('Auto & Repair');
    expect(businessType('nope')).toBeNull();
  });

  it('"From" prices match what the checkout charges for the smallest order', () => {
    expect(fromPrice().total).toBe(PRICES[100]);
    expect(fromPrice('thick').total).toBe(priceCards(100, { stock: 'thick' }).subtotal);
    expect(fromPrice('gloss').total).toBe(priceCards(100, { finish: 'gloss' }).subtotal);
    expect(fromPrice().each).toBe(Math.round((PRICES[100] / 100) * 100) / 100);
  });

  it('an uploaded design that fills the card survives the server check', () => {
    const href = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
    const d = sanitizeDesign({ template: 'minimal', font: 'sans', front: { bg: '#ffffff', elements: [{ id: 'u1', type: 'image', x: 0, y: 0, w: CARD_W, h: CARD_H, href }] }, back: { bg: '#ffffff', elements: [] } });
    expect(d.front.elements).toHaveLength(1);
    expect(d.front.elements[0]).toMatchObject({ type: 'image', w: CARD_W, h: CARD_H });
  });
});
