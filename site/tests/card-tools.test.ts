import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { makeTemplate, PALETTES, sanitizeDesign, CARD_W, CARD_H } from '../src/lib/cards';
import { setPattern, clearPattern, isPattern, patternSvg, PATTERNS, ICONS, SHAPES, graphicEl, iconSvg } from '../src/lib/cardArt';
import { BLANK, buildCard, detailsFromDesign, swapTemplate, validateSpec, cardFromSpec, demoSpecs } from '../src/lib/cardDesign';

// Editor tools and Design with AI (Peter, Nov 15 2026).
describe('card art', () => {
  it('every pattern, icon and shape is a picture the order check keeps', () => {
    const els = [
      ...PATTERNS.map((p, i) => ({ id: `p${i}`, type: 'image', x: 0, y: 0, w: CARD_W, h: CARD_H, href: patternSvg(p.kind, '#ffffff', '#1d4ed8') })),
      ...Object.keys(ICONS).map((k) => graphicEl('icon', k, '#29276e')),
      ...Object.keys(SHAPES).map((k) => graphicEl('shape', k, '#c2410c')),
    ];
    // One at a time: a side holds at most 40 items.
    for (const el of els) {
      const d = sanitizeDesign({ template: 'classic', font: 'sans', front: { bg: '#ffffff', elements: [el] }, back: { bg: '#ffffff', elements: [] } });
      expect(d.front.elements).toHaveLength(1);
    }
  });

  it('a pattern sits behind everything, replaces an old one, and can be removed', () => {
    const side = makeTemplate('classic', PALETTES[0], BLANK, true).front;
    const one = setPattern(side, 'dots', '#ffffff', '#111111');
    const two = setPattern(one, 'waves', '#e8f1fb', '#1d4ed8');
    expect(isPattern(two.elements[0])).toBe(true);
    expect(two.elements.filter(isPattern)).toHaveLength(1);
    expect(two.bg).toBe('#e8f1fb');
    expect(clearPattern(two).elements.some(isPattern)).toBe(false);
  });
});

describe('Templates tool: switching layout keeps what was typed', () => {
  it('reads the typed details back, field by field', () => {
    const d = buildCard('classic', 0, { ...BLANK, name: 'Dana Lee', company: 'Bayou Kitchen', phone: '(318) 555-0100' });
    const got = detailsFromDesign(d);
    expect([got.name, got.company, got.phone, got.email]).toEqual(['Dana Lee', 'Bayou Kitchen', '(318) 555-0100', BLANK.email]);
  });

  it('carries words, uploaded pictures, graphics and the pattern to the new layout and colors', () => {
    let d = buildCard('classic', 0, { ...BLANK, name: 'Dana Lee', company: 'Bayou Kitchen' });
    d.front = setPattern(d.front, 'dots', '#fdf2d0', '#a16207');
    const logo = { id: 'uLogo1', type: 'image' as const, x: 10, y: 10, w: 100, h: 100, href: 'data:image/png;base64,AAAA' };
    const star = graphicEl('icon', 'star', '#000000');
    d.front.elements.push(logo, star);
    const next = swapTemplate(d, 'band', 7);
    expect(next.template).toBe('band');
    const texts = [...next.front.elements, ...next.back.elements].filter((e) => e.type === 'text').map((e: any) => e.text).join('|');
    expect(texts).toContain('Dana Lee');
    expect(texts).toContain('Bayou Kitchen');
    expect(next.front.elements.some((e) => e.id === 'uLogo1')).toBe(true);
    expect(next.front.elements.some((e) => e.id === star.id)).toBe(true);
    expect(isPattern(next.front.elements[0])).toBe(true);
    // Typed words are no longer grey sample text; untouched fields still are.
    const nameEl: any = next.front.elements.find((e: any) => e.type === 'text' && e.text.includes('Dana Lee'));
    expect(nameEl.placeholder).toBe(false);
  });
});

describe('Design with AI', () => {
  it('validateSpec keeps only catalog pieces and short plain wording', () => {
    const s = validateSpec({ template: 'hacked', palette: 99, pattern: { kind: 'evil', bg: 'red', fg: '#000' }, icon: 'skull', details: { company: 'A'.repeat(200), phone: 'x\u0000y' }, why: 'ok' });
    expect(s.template).toBe('classic');
    expect(s.palette).toBe(0);
    expect(s.pattern).toBeNull();
    expect(s.icon).toBeNull();
    expect(s.details.company!.length).toBe(40);
    expect(s.details.phone).toBe('x y');
  });

  it('a spec becomes an editable card with its pattern and icon', () => {
    const d = cardFromSpec(validateSpec({ template: 'band', palette: 7, pattern: { kind: 'waves', bg: '#ffffff', fg: '#c2410c' }, icon: 'food', details: { company: 'Bayou Boil' }, why: 'Warm and fun.' }));
    expect(isPattern(d.front.elements[0])).toBe(true);
    expect(d.front.elements.some((e) => e.type === 'image' && e.href === iconSvg('food', PALETTES[7].accent))).toBe(true);
    expect(sanitizeDesign(d).front.elements.length).toBe(d.front.elements.length);
  });

  it('demo mode (no AI key) reads the business type, colors and a quoted name', () => {
    const specs = demoSpecs('A fun card for my crawfish restaurant "Bayou Boil", red and gold');
    expect(specs).toHaveLength(3);
    expect(specs[0].template).toBe('band'); // the restaurant layout
    expect(specs.every((s) => s.details.company === 'Bayou Boil' && s.icon === 'food')).toBe(true);
    expect(new Set(specs.map((s) => s.template)).size).toBe(3);
  });
});

describe('the AI endpoint without a key', () => {
  const call = async (body: unknown, cookie?: string) => {
    const { POST } = await import('../src/pages/api/card-ai');
    const res = await (POST as any)({ request: new Request('http://x/api/card-ai', { method: 'POST', body: JSON.stringify(body), headers: cookie ? { cookie } : {} }) });
    return { status: res.status, body: await res.json() };
  };
  beforeAll(() => { Object.assign(env as any, { ANTHROPIC_API_KEY: '' }); });

  it('needs a signed-in customer', async () => {
    expect((await call({ prompt: 'a bakery' })).status).toBe(401);
  });
});
