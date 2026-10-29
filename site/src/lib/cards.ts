// Business card model and renderer. Pure functions, no DOM, so the same code draws the
// editor canvas in the browser, the saved order on the server, and the counter's print sheet.
// Card is 3.5 x 2 in. Units are pixels at 300 dpi: 1050 x 600. Safe area is 0.1875 in in.

export const CARD_W = 1050;
export const CARD_H = 600;
export const SAFE = 56;

export type FontId = 'sans' | 'serif' | 'mono' | 'rounded' | 'elegant' | 'display';
export type TemplateId = 'classic' | 'band' | 'minimal' | 'topbar' | 'bottombar' | 'frame' | 'corner' | 'rightband' | 'monogram' | 'split' | 'circle' | 'diagonal';
export type Align = 'start' | 'middle' | 'end';

export interface TextEl {
  id: string; type: 'text';
  x: number; y: number; w: number;          // box: x,y top-left, w width. Height follows the lines.
  text: string; size: number; weight: 400 | 700; italic: boolean; color: string; align: Align;
  placeholder?: boolean;                     // still the template's sample text, drawn lighter
}
export interface ImageEl {
  id: string; type: 'image';
  x: number; y: number; w: number; h: number;
  href: string;                              // data: URL
}
export type El = TextEl | ImageEl;
export interface Side { bg: string; elements: El[] }
export interface Design { template: TemplateId; font: FontId; front: Side; back: Side }

export const FONTS: Record<FontId, string> = {
  sans: "'Segoe UI', Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "Consolas, Menlo, monospace",
  rounded: "Verdana, Geneva, sans-serif",
  elegant: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  display: "Impact, 'Arial Black', sans-serif",
};
export const FONT_NAMES: Record<FontId, string> = { sans: 'Clean sans', serif: 'Classic serif', mono: 'Typewriter', rounded: 'Rounded', elegant: 'Elegant serif', display: 'Bold display' };

export const PALETTES = [
  { name: 'Navy and kraft', accent: '#0f1d3a', ink: '#17202d', paper: '#ffffff' },
  { name: 'Kraft', accent: '#b98a55', ink: '#17202d', paper: '#fbf7f0' },
  { name: 'Blue', accent: '#1d4ed8', ink: '#17202d', paper: '#ffffff' },
  { name: 'Black', accent: '#111111', ink: '#111111', paper: '#ffffff' },
  { name: 'Forest', accent: '#1f5f3b', ink: '#13261b', paper: '#ffffff' },
  { name: 'Wine', accent: '#7a1f2e', ink: '#2a1216', paper: '#fffaf9' },
  { name: 'Teal', accent: '#0f766e', ink: '#0f2a28', paper: '#ffffff' },
  { name: 'Sunset', accent: '#c2410c', ink: '#2a1a12', paper: '#fff7ed' },
  { name: 'Slate', accent: '#334155', ink: '#0f172a', paper: '#f8fafc' },
  { name: 'Rose', accent: '#9d174d', ink: '#2a0f1c', paper: '#fff1f6' },
  { name: 'Gold', accent: '#a16207', ink: '#2a2008', paper: '#fffbeb' },
  { name: 'Sky', accent: '#0369a1', ink: '#0c1f2e', paper: '#ffffff' },
];
export type Palette = typeof PALETTES[number];

export const TEMPLATES: { id: TemplateId; name: string }[] = [
  { id: 'classic', name: 'Classic' },
  { id: 'band', name: 'Band' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'topbar', name: 'Top bar' },
  { id: 'bottombar', name: 'Bottom bar' },
  { id: 'frame', name: 'Frame' },
  { id: 'corner', name: 'Corners' },
  { id: 'rightband', name: 'Right band' },
  { id: 'monogram', name: 'Monogram' },
  { id: 'split', name: 'Split' },
  { id: 'circle', name: 'Circle' },
  { id: 'diagonal', name: 'Diagonal' },
];

// Sample details for the gallery previews.
export const SAMPLE = {
  name: 'Rin Ho', title: 'Owner', company: "Goin' Postal Forsythe",
  phone: '(318) 000-0000', email: 'hello@example.com', website: 'goinpostalforsythe.com',
  address: '1800 Forsythe Ave Ste 2, Monroe, LA', tagline: 'Ship it. Pack it. Print it.',
};
export type Details = typeof SAMPLE;

let seq = 0;
export const uid = () => 'e' + (++seq) + Math.random().toString(36).slice(2, 6);

function t(partial: Partial<TextEl> & { x: number; y: number; w: number; text: string; size: number }): TextEl {
  return { id: uid(), type: 'text', weight: 400, italic: false, color: '#17202d', align: 'start', ...partial };
}

/** Builds a full design from a template, palette and details. `placeholder` marks the texts as sample copy. */
export function makeTemplate(id: TemplateId, p: Palette, d: Details, placeholder: boolean): Design {
  const ph = placeholder;
  const contact = [d.phone, d.email, d.website, d.address];
  let front: Side;
  if (id === 'band') {
    const bw = 360;
    front = { bg: p.paper, elements: [
      { id: uid(), type: 'image', x: 0, y: 0, w: bw, h: CARD_H, href: solid(p.accent) },
      t({ x: 20, y: 250, w: bw - 40, text: initials(d.name), size: 110, weight: 700, color: p.paper, align: 'middle', placeholder: ph }),
      t({ x: bw + SAFE, y: 150, w: CARD_W - bw - 2 * SAFE, text: d.name, size: 56, weight: 700, color: p.ink, placeholder: ph }),
      t({ x: bw + SAFE, y: 222, w: CARD_W - bw - 2 * SAFE, text: d.title, size: 28, weight: 700, color: p.accent, placeholder: ph }),
      t({ x: bw + SAFE, y: 266, w: CARD_W - bw - 2 * SAFE, text: d.company, size: 30, weight: 700, color: p.ink, placeholder: ph }),
      t({ x: bw + SAFE, y: 350, w: CARD_W - bw - 2 * SAFE, text: contact.join('\n'), size: 26, color: p.ink, placeholder: ph }),
    ] };
  } else if (id === 'minimal') {
    front = { bg: p.paper, elements: [
      t({ x: SAFE, y: 120, w: CARD_W - 2 * SAFE, text: d.name, size: 60, weight: 700, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 200, w: CARD_W - 2 * SAFE, text: `${d.title}  ·  ${d.company}`, size: 28, weight: 700, color: p.accent, placeholder: ph }),
      { id: uid(), type: 'image', x: SAFE, y: 262, w: 120, h: 4, href: solid(p.accent) },
      t({ x: SAFE, y: 310, w: CARD_W - 2 * SAFE, text: contact.join('\n'), size: 25, color: p.ink, placeholder: ph }),
    ] };
  } else if (id === 'topbar') {
    front = { bg: p.paper, elements: [
      img(0, 0, CARD_W, 250, solid(p.accent)),
      t({ x: SAFE, y: 80, w: CARD_W - 2 * SAFE, text: d.name, size: 60, weight: 700, color: p.paper, placeholder: ph }),
      t({ x: SAFE, y: 160, w: CARD_W - 2 * SAFE, text: d.title, size: 28, color: p.paper, placeholder: ph }),
      t({ x: SAFE, y: 290, w: CARD_W - 2 * SAFE, text: d.company, size: 32, weight: 700, color: p.accent, placeholder: ph }),
      t({ x: SAFE, y: 350, w: CARD_W - 2 * SAFE, text: contact.join('\n'), size: 25, color: p.ink, placeholder: ph }),
    ] };
  } else if (id === 'bottombar') {
    front = { bg: p.paper, elements: [
      img(0, 400, CARD_W, 200, solid(p.accent)),
      t({ x: SAFE, y: 110, w: CARD_W - 2 * SAFE, text: d.name, size: 64, weight: 700, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 195, w: CARD_W - 2 * SAFE, text: d.title, size: 28, weight: 700, color: p.accent, placeholder: ph }),
      t({ x: SAFE, y: 245, w: CARD_W - 2 * SAFE, text: d.company, size: 30, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 430, w: CARD_W / 2 - SAFE, text: [d.phone, d.email].join('\n'), size: 24, color: p.paper, placeholder: ph }),
      t({ x: CARD_W / 2, y: 430, w: CARD_W / 2 - SAFE, text: [d.website, d.address].join('\n'), size: 24, color: p.paper, align: 'end', placeholder: ph }),
    ] };
  } else if (id === 'frame') {
    front = { bg: p.paper, elements: [
      img(30, 30, CARD_W - 60, CARD_H - 60, shape('ring', p.accent)),
      t({ x: SAFE, y: 140, w: CARD_W - 2 * SAFE, text: d.name, size: 60, weight: 700, color: p.ink, align: 'middle', placeholder: ph }),
      t({ x: SAFE, y: 215, w: CARD_W - 2 * SAFE, text: `${d.title}  ·  ${d.company}`, size: 26, color: p.accent, align: 'middle', placeholder: ph }),
      img(CARD_W / 2 - 60, 270, 120, 3, solid(p.accent)),
      t({ x: SAFE, y: 310, w: CARD_W - 2 * SAFE, text: contact.join('\n'), size: 24, color: p.ink, align: 'middle', placeholder: ph }),
    ] };
  } else if (id === 'corner') {
    front = { bg: p.paper, elements: [
      img(0, 0, 260, 260, shape('tri-tl', p.accent)),
      img(CARD_W - 260, CARD_H - 260, 260, 260, shape('tri-br', p.accent)),
      t({ x: SAFE, y: 170, w: CARD_W - 2 * SAFE, text: d.name, size: 62, weight: 700, color: p.ink, align: 'middle', placeholder: ph }),
      t({ x: SAFE, y: 250, w: CARD_W - 2 * SAFE, text: d.title, size: 28, weight: 700, color: p.accent, align: 'middle', placeholder: ph }),
      t({ x: SAFE, y: 296, w: CARD_W - 2 * SAFE, text: d.company, size: 30, color: p.ink, align: 'middle', placeholder: ph }),
      t({ x: 200, y: 370, w: CARD_W - 400, text: [d.phone, d.email, d.website].join('  ·  '), size: 22, color: p.ink, align: 'middle', placeholder: ph }),
    ] };
  } else if (id === 'rightband') {
    const bw = 340;
    front = { bg: p.paper, elements: [
      img(CARD_W - bw, 0, bw, CARD_H, solid(p.accent)),
      t({ x: CARD_W - bw + 20, y: 250, w: bw - 40, text: initials(d.name), size: 110, weight: 700, color: p.paper, align: 'middle', placeholder: ph }),
      t({ x: SAFE, y: 140, w: CARD_W - bw - 2 * SAFE, text: d.name, size: 56, weight: 700, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 212, w: CARD_W - bw - 2 * SAFE, text: d.title, size: 28, weight: 700, color: p.accent, placeholder: ph }),
      t({ x: SAFE, y: 256, w: CARD_W - bw - 2 * SAFE, text: d.company, size: 30, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 340, w: CARD_W - bw - 2 * SAFE, text: contact.join('\n'), size: 25, color: p.ink, placeholder: ph }),
    ] };
  } else if (id === 'monogram') {
    front = { bg: p.paper, elements: [
      t({ x: 560, y: -60, w: 500, text: initials(d.name).slice(0, 1), size: 560, weight: 700, color: p.accent + '22' as any, align: 'end', placeholder: ph }),
      t({ x: SAFE, y: 320, w: CARD_W - 2 * SAFE, text: d.name, size: 60, weight: 700, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 398, w: CARD_W - 2 * SAFE, text: `${d.title}  ·  ${d.company}`, size: 26, weight: 700, color: p.accent, placeholder: ph }),
      t({ x: SAFE, y: 450, w: CARD_W - 2 * SAFE, text: [d.phone, d.email, d.website].join('  ·  '), size: 22, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 60, w: 600, text: d.address, size: 22, color: p.ink, placeholder: ph }),
    ] };
  } else if (id === 'split') {
    front = { bg: p.paper, elements: [
      img(0, 0, CARD_W / 2, CARD_H, solid(p.accent)),
      t({ x: SAFE, y: 200, w: CARD_W / 2 - 2 * SAFE, text: d.name, size: 54, weight: 700, color: p.paper, placeholder: ph }),
      t({ x: SAFE, y: 272, w: CARD_W / 2 - 2 * SAFE, text: d.title, size: 26, color: p.paper, placeholder: ph }),
      t({ x: SAFE, y: 320, w: CARD_W / 2 - 2 * SAFE, text: d.company, size: 28, weight: 700, color: p.paper, placeholder: ph }),
      t({ x: CARD_W / 2 + SAFE, y: 200, w: CARD_W / 2 - 2 * SAFE, text: contact.join('\n'), size: 26, color: p.ink, placeholder: ph }),
    ] };
  } else if (id === 'circle') {
    front = { bg: p.paper, elements: [
      img(-140, 100, 400, 400, shape('circle', p.accent)),
      t({ x: 0, y: 240, w: 260, text: initials(d.name), size: 100, weight: 700, color: p.paper, align: 'middle', placeholder: ph }),
      t({ x: 340, y: 150, w: CARD_W - 340 - SAFE, text: d.name, size: 56, weight: 700, color: p.ink, placeholder: ph }),
      t({ x: 340, y: 222, w: CARD_W - 340 - SAFE, text: d.title, size: 28, weight: 700, color: p.accent, placeholder: ph }),
      t({ x: 340, y: 266, w: CARD_W - 340 - SAFE, text: d.company, size: 30, color: p.ink, placeholder: ph }),
      t({ x: 340, y: 345, w: CARD_W - 340 - SAFE, text: contact.join('\n'), size: 24, color: p.ink, placeholder: ph }),
    ] };
  } else if (id === 'diagonal') {
    front = { bg: p.paper, elements: [
      img(500, 0, 550, CARD_H, shape('diag', p.accent)),
      t({ x: SAFE, y: 130, w: 560, text: d.name, size: 58, weight: 700, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 205, w: 560, text: d.title, size: 28, weight: 700, color: p.accent, placeholder: ph }),
      t({ x: SAFE, y: 250, w: 560, text: d.company, size: 30, color: p.ink, placeholder: ph }),
      t({ x: SAFE, y: 340, w: 480, text: contact.join('\n'), size: 24, color: p.ink, placeholder: ph }),
      t({ x: 700, y: 420, w: 300, text: initials(d.name), size: 90, weight: 700, color: p.paper, align: 'end', placeholder: ph }),
    ] };
  } else {
    front = { bg: p.paper, elements: [
      { id: uid(), type: 'image', x: 0, y: 0, w: CARD_W, h: 18, href: solid(p.accent) },
      t({ x: SAFE, y: 150, w: CARD_W - 2 * SAFE, text: d.name, size: 60, weight: 700, color: p.ink, align: 'middle', placeholder: ph }),
      t({ x: SAFE, y: 226, w: CARD_W - 2 * SAFE, text: d.title, size: 28, weight: 700, color: p.accent, align: 'middle', placeholder: ph }),
      t({ x: SAFE, y: 270, w: CARD_W - 2 * SAFE, text: d.company, size: 30, weight: 700, color: p.ink, align: 'middle', placeholder: ph }),
      t({ x: SAFE, y: 350, w: CARD_W - 2 * SAFE, text: contact.join('\n'), size: 25, color: p.ink, align: 'middle', placeholder: ph }),
    ] };
  }
  const back: Side = { bg: p.accent, elements: [
    t({ x: SAFE, y: 230, w: CARD_W - 2 * SAFE, text: d.company, size: 48, weight: 700, color: p.paper, align: 'middle', placeholder: ph }),
    t({ x: SAFE, y: 310, w: CARD_W - 2 * SAFE, text: d.tagline, size: 28, color: p.paper, align: 'middle', placeholder: ph }),
  ] };
  return { template: id, font: 'sans', front, back };
}

export const initials = (n: string) => n.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 3).toUpperCase() || 'GP';

/** A 1x1 solid-color SVG as a data URL, so colored blocks are just images and can be moved like anything else. */
export function solid(hex: string) {
  return 'data:image/svg+xml;base64,' + b64(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="${hex}"/></svg>`);
}
/** Other shapes as stretchable 100x100 SVGs. */
export function shape(kind: 'circle' | 'tri-tl' | 'tri-br' | 'diag' | 'ring', hex: string) {
  const inner = {
    'circle': `<circle cx="50" cy="50" r="50" fill="${hex}"/>`,
    'tri-tl': `<polygon points="0,0 100,0 0,100" fill="${hex}"/>`,
    'tri-br': `<polygon points="100,100 0,100 100,0" fill="${hex}"/>`,
    'diag': `<polygon points="0,100 100,0 100,100" fill="${hex}"/>`,
    'ring': `<rect x="2" y="2" width="96" height="96" fill="none" stroke="${hex}" stroke-width="3" vector-effect="non-scaling-stroke"/>`,
  }[kind];
  return 'data:image/svg+xml;base64,' + b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${inner}</svg>`);
}
const img = (x: number, y: number, w: number, h: number, href: string): ImageEl => ({ id: uid(), type: 'image', x, y, w, h, href });
function b64(s: string) {
  if (typeof btoa === 'function') return btoa(s);
  return Buffer.from(s).toString('base64');
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function textHeight(el: TextEl) {
  return el.text.split('\n').length * el.size * 1.25;
}

function renderEl(el: El, opts: { editing?: boolean }) {
  if (el.type === 'image') {
    return `<image data-id="${el.id}" href="${el.href}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="none"/>`;
  }
  const lines = el.text.split('\n');
  const ax = el.align === 'middle' ? el.x + el.w / 2 : el.align === 'end' ? el.x + el.w : el.x;
  const lh = el.size * 1.25;
  const fill = el.placeholder && opts.editing ? '#8a93a3' : el.color;
  const tspans = lines.map((l, i) => `<tspan x="${ax}" dy="${i === 0 ? 0 : lh}">${esc(l) || ' '}</tspan>`).join('');
  return `<text data-id="${el.id}" x="${ax}" y="${el.y + el.size}" font-size="${el.size}" font-weight="${el.weight}" font-style="${el.italic ? 'italic' : 'normal'}" fill="${fill}" text-anchor="${el.align}" xml:space="preserve">${tspans}</text>`
    + (opts.editing ? `<rect data-id="${el.id}" x="${el.x}" y="${el.y}" width="${el.w}" height="${textHeight(el)}" fill="transparent"/>` : '');
}

export function renderCard(d: Design, side: 'front' | 'back', opts: { guides?: boolean; editing?: boolean; selected?: string | null } = {}): string {
  const s = d[side];
  const guides = opts.guides
    ? `<rect x="${SAFE}" y="${SAFE}" width="${CARD_W - 2 * SAFE}" height="${CARD_H - 2 * SAFE}" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-dasharray="12 10" opacity=".5" pointer-events="none"/>`
    : '';
  const sel = opts.selected ? s.elements.find((e) => e.id === opts.selected) : null;
  const selBox = sel
    ? `<rect x="${sel.x - 6}" y="${sel.y - 6}" width="${sel.w + 12}" height="${(sel.type === 'text' ? textHeight(sel) : sel.h) + 12}" fill="none" stroke="#1d4ed8" stroke-width="3" pointer-events="none"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" font-family="${FONTS[d.font]}">
  <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" fill="${s.bg}" data-bg="1"/>
  ${s.elements.map((e) => renderEl(e, opts)).join('\n  ')}
  ${guides}${selBox}
</svg>`;
}

// ---- server-side sanitizing --------------------------------------------------

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const DATA_IMG = /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const num = (v: any, min: number, max: number, fb: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fb);

function sanitizeSide(v: any, fallbackBg: string): Side {
  const els: El[] = [];
  for (const e of Array.isArray(v?.elements) ? v.elements.slice(0, 40) : []) {
    const base = { id: String(e?.id ?? uid()).slice(0, 24), x: num(e?.x, -CARD_W, 2 * CARD_W, 0), y: num(e?.y, -CARD_H, 2 * CARD_H, 0), w: num(e?.w, 1, 2 * CARD_W, 100) };
    if (e?.type === 'image') {
      const href = String(e?.href ?? '');
      if (!DATA_IMG.test(href) || href.length > 400_000) continue;
      els.push({ ...base, type: 'image', h: num(e?.h, 1, 2 * CARD_H, 100), href });
    } else if (e?.type === 'text') {
      els.push({
        ...base, type: 'text',
        text: String(e?.text ?? '').slice(0, 300), size: num(e?.size, 8, 300, 24),
        weight: e?.weight === 700 ? 700 : 400, italic: !!e?.italic,
        color: HEX.test(e?.color) ? e.color : '#17202d',
        align: (['start', 'middle', 'end'] as const).includes(e?.align) ? e.align : 'start',
        placeholder: !!e?.placeholder,
      });
    }
  }
  return { bg: HEX.test(v?.bg) ? v.bg : fallbackBg, elements: els };
}

export function sanitizeDesign(v: any): Design {
  return {
    template: TEMPLATES.some((x) => x.id === v?.template) ? v.template : 'classic',
    font: (Object.keys(FONTS) as FontId[]).includes(v?.font) ? v.font : 'sans',
    front: sanitizeSide(v?.front, '#ffffff'),
    back: sanitizeSide(v?.back, '#0f1d3a'),
  };
}

export const QUANTITIES = [100, 250, 500, 1000];
// Shop prices. TODO owners: confirm per-quantity pricing (issue 9).
export const PRICES: Record<number, number> = { 100: 24.99, 250: 39.99, 500: 59.99, 1000: 89.99 };

// ---- upsells: stock, finish, rounded corners, rush ---------------------------------
// Priced per order, not per card, and always computed here on the server from the picks the
// browser sends. The order form shows the same table so the customer sees the total before paying.
// TODO owners: confirm these prices (issue 9).

export type OptionGroup = 'stock' | 'finish' | 'corners' | 'speed';
export interface CardOption { group: OptionGroup; code: string; name: string; price: number; default?: boolean }
export const CARD_OPTIONS: CardOption[] = [
  { group: 'stock', code: 'standard', name: 'Standard 14 pt', price: 0, default: true },
  { group: 'stock', code: 'thick', name: 'Thick 16 pt', price: 5 },
  { group: 'stock', code: 'linen', name: 'Linen', price: 8 },
  { group: 'finish', code: 'matte', name: 'Matte', price: 0, default: true },
  { group: 'finish', code: 'gloss', name: 'Gloss', price: 4 },
  { group: 'finish', code: 'softtouch', name: 'Soft touch', price: 6 },
  { group: 'corners', code: 'square', name: 'Square corners', price: 0, default: true },
  { group: 'corners', code: 'rounded', name: 'Rounded corners', price: 6 },
  { group: 'speed', code: 'normal', name: 'Ready in 3 business days', price: 0, default: true },
  { group: 'speed', code: 'rush', name: 'Rush, next business day', price: 10 },
];
export const OPTION_GROUPS: OptionGroup[] = ['stock', 'finish', 'corners', 'speed'];
export interface CardOptionLine { group: OptionGroup; code: string; name: string; price: number }

/** The option a customer picked in each group. Unknown codes fall back to the group's free default; only paid picks become lines. */
export function priceCardOptions(picks: Record<string, unknown> | undefined): { lines: CardOptionLine[]; total: number; chosen: Record<OptionGroup, string> } {
  const lines: CardOptionLine[] = [];
  const chosen = {} as Record<OptionGroup, string>;
  for (const g of OPTION_GROUPS) {
    const want = String(picks?.[g] ?? '');
    const opt = CARD_OPTIONS.find((o) => o.group === g && o.code === want) ?? CARD_OPTIONS.find((o) => o.group === g && o.default)!;
    chosen[g] = opt.code;
    if (opt.price > 0) lines.push({ group: g, code: opt.code, name: opt.name, price: opt.price });
  }
  return { lines, total: Math.round(lines.reduce((a, l) => a + l.price, 0) * 100) / 100, chosen };
}

/** Everything a card order costs before the online fee: the cards at their quantity price plus the paid options. */
export function priceCards(quantity: number, picks?: Record<string, unknown>) {
  const price = PRICES[quantity];
  if (!price) throw new Error('Pick a quantity');
  const options = priceCardOptions(picks);
  return { price, options: options.lines, chosen: options.chosen, subtotal: Math.round((price + options.total) * 100) / 100 };
}

/** The option in force for every group on a saved order: its paid lines, defaults for the rest. Older orders with no lines show all defaults. */
export function chosenOptions(lines: CardOptionLine[] | undefined): CardOption[] {
  return OPTION_GROUPS.map((g) => CARD_OPTIONS.find((o) => o.group === g && lines?.some((l) => l.group === g && l.code === o.code)) ?? CARD_OPTIONS.find((o) => o.group === g && o.default)!);
}

// ---- where a card order gets printed (T27, item 56) -----------------------------------------------
export type CardPrinter = 'shop' | 'trade' | 'local';
export const PRINTER_NAMES: Record<CardPrinter, string> = { shop: 'In the shop (laser, 10-up sheet)', trade: 'Trade printer, shipped in (4over)', local: 'Sir Speedy Monroe (rush)' };
/** The chart in monetization/business-cards: any upsell or 500 and up goes to the trade printer unless rushed; standard 100 or 250 prints in the shop; rushed non-standard goes to the local printer. */
export function routeCard(o: { quantity: number; options?: { group: string; code: string }[] }): { printer: CardPrinter; why: string } {
  const opts = o.options ?? [];
  const rush = opts.some((x) => x.code === 'rush');
  const special = opts.some((x) => x.group !== 'speed');
  if (!special && o.quantity <= 250) return { printer: 'shop', why: `standard stock, ${o.quantity} cards${rush ? ', rush' : ''}` };
  if (rush) return { printer: 'local', why: `rush with ${special ? opts.filter((x) => x.group !== 'speed').map((x) => x.code).join(', ') : `${o.quantity} cards`}` };
  return { printer: 'trade', why: special ? opts.map((x) => x.code).join(', ') + `, ${o.quantity} cards, not rushed` : `${o.quantity} cards, not rushed` };
}
