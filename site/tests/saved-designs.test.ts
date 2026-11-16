import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:workers';
import { saveSavedDesign, listSavedDesigns, getSavedDesign, markSavedDesignOrdered, deleteSavedDesign, exportTable, SAVED_DESIGNS_MAX } from '../src/shipping/store';
import { designForSaving, cardName, cleanPicks, cleanQuantity, SAVED_DESIGN_MAX } from '../src/lib/savedCards';
import { makeTemplate, PALETTES, SAMPLE, CARD_W, CARD_H } from '../src/lib/cards';

// Saved designs on the account (Peter, Nov 15 2026): edit, reorder, and nobody else's.
const E = env as any;
const card = () => makeTemplate('classic', PALETTES[0], SAMPLE, false);

describe('saved designs', () => {
  it('saves, updates in place, remembers the last order, and deletes, only for its owner', async () => {
    const { json } = designForSaving(card());
    const a = await saveSavedDesign(E, { customer_id: 'cust-a', product: 'card', name: 'Rin Ho', design_json: json });
    const again = await saveSavedDesign(E, { customer_id: 'cust-a', product: 'card', id: a.id, name: 'Rin Ho v2', design_json: json });
    expect(again.id).toBe(a.id);
    expect((await listSavedDesigns(E, 'cust-a', 'card')).map((d) => d.name)).toEqual(['Rin Ho v2']);
    // Another customer can't read, update or delete it.
    expect(await getSavedDesign(E, 'cust-b', a.id)).toBeNull();
    const b = await saveSavedDesign(E, { customer_id: 'cust-b', product: 'card', id: a.id, name: 'Hijack', design_json: json });
    expect(b.id).not.toBe(a.id);
    expect((await getSavedDesign(E, 'cust-a', a.id))!.name).toBe('Rin Ho v2');
    expect(await deleteSavedDesign(E, 'cust-b', a.id)).toBe(false);
    await markSavedDesignOrdered(E, 'cust-a', a.id, { order_id: 'CD-TEST01', quantity: 250, options_json: JSON.stringify({ finish: 'gloss' }) });
    const got = (await getSavedDesign(E, 'cust-a', a.id))!;
    expect([got.last_quantity, got.last_order_id, JSON.parse(got.last_options_json!)]).toEqual([250, 'CD-TEST01', { finish: 'gloss' }]);
    expect((await exportTable(E, 'saved_designs')).length).toBeGreaterThan(0);
    expect(await deleteSavedDesign(E, 'cust-a', a.id)).toBe(true);
    expect(await listSavedDesigns(E, 'cust-a')).toEqual([]);
  });

  it(`keeps at most ${SAVED_DESIGNS_MAX} of a product per customer`, async () => {
    const { json } = designForSaving(card());
    for (let i = 0; i < SAVED_DESIGNS_MAX; i++) await saveSavedDesign(E, { customer_id: 'cust-full', product: 'card', name: `c${i}`, design_json: json });
    await expect(saveSavedDesign(E, { customer_id: 'cust-full', product: 'card', name: 'one more', design_json: json })).rejects.toThrow(/up to/);
  });

  it('names a card from its first typed words, and refuses one that is too big', () => {
    expect(cardName(card())).toBe('Rin Ho');
    expect(cardName(card(), '  My  cards ')).toBe('My cards');
    const blank = { template: 'minimal', font: 'sans', front: { bg: '#fff', elements: [] }, back: { bg: '#fff', elements: [] } } as any;
    expect(cardName(blank)).toBe('My business card');
    const pic = 'data:image/jpeg;base64,' + 'A'.repeat(390_000);
    const huge = { ...blank, front: { bg: '#fff', elements: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, type: 'image', x: 0, y: 0, w: CARD_W, h: CARD_H, href: pic })) } };
    expect(JSON.stringify(huge).length).toBeGreaterThan(SAVED_DESIGN_MAX);
    expect(() => designForSaving(huge)).toThrow(/too many large pictures/);
  });

  it('only real options and quantities come back for Reorder', () => {
    expect(cleanPicks({ stock: 'thick', finish: 'shiny-gold', corners: 'rounded', extra: 'x' })).toEqual({ stock: 'thick', corners: 'rounded' });
    expect(cleanQuantity(250)).toBe(250);
    expect(cleanQuantity(7)).toBeNull();
  });
});
