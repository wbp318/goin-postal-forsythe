// Card art the store owns (Peter, Nov 15 2026): background colors and patterns, icons and shapes for the
// editor's Background and Graphics tools, and the pieces "Design with AI" chooses from. Everything is drawn
// here as small SVGs, so nothing belongs to anyone else, and each becomes an image element on the card
// (data:image/svg+xml, which the order check already accepts). Pure functions, no DOM.
import { CARD_W, CARD_H, uid, type ImageEl, type Design, type Side } from './cards';

const b64 = (s: string) => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64'));
const svgUrl = (svg: string) => 'data:image/svg+xml;base64,' + b64(svg);

/** Curated background colors: soft, print-friendly, plus a few strong ones. */
export const BG_COLORS = ['#ffffff', '#fbf7f0', '#f5efe4', '#e8f1fb', '#e6f4ea', '#fdf2d0', '#fde7da', '#fbe4ec', '#ede7f6', '#e0f2f1', '#0f1d3a', '#29276e', '#1f5f3b', '#7a1f2e', '#111111', '#c2410c'];

// ---- patterns -----------------------------------------------------------------------------------------
export type PatternKind = 'dots' | 'stripes' | 'diagonal' | 'grid' | 'waves' | 'chevron' | 'confetti' | 'leaves' | 'circles' | 'crosshatch';
export const PATTERNS: { kind: PatternKind; name: string }[] = [
  { kind: 'dots', name: 'Dots' }, { kind: 'stripes', name: 'Stripes' }, { kind: 'diagonal', name: 'Diagonal' },
  { kind: 'grid', name: 'Grid' }, { kind: 'waves', name: 'Waves' }, { kind: 'chevron', name: 'Chevron' },
  { kind: 'confetti', name: 'Confetti' }, { kind: 'leaves', name: 'Leaves' }, { kind: 'circles', name: 'Circles' },
  { kind: 'crosshatch', name: 'Crosshatch' },
];
/** Color pairs the pattern gallery shows: [background, pattern]. */
export const PATTERN_COLORS: [string, string][] = [
  ['#e8f1fb', '#1d4ed8'], ['#e6f4ea', '#1f5f3b'], ['#fdf2d0', '#a16207'], ['#fbe4ec', '#9d174d'], ['#0f1d3a', '#f2b705'], ['#ffffff', '#111111'],
];
const TILE: Record<PatternKind, (fg: string) => { w: number; h: number; body: string }> = {
  dots: (fg) => ({ w: 40, h: 40, body: `<circle cx="10" cy="10" r="4" fill="${fg}"/><circle cx="30" cy="30" r="4" fill="${fg}"/>` }),
  stripes: (fg) => ({ w: 40, h: 40, body: `<rect width="40" height="12" fill="${fg}"/>` }),
  diagonal: (fg) => ({ w: 30, h: 30, body: `<path d="M-8 8 L8 -8 M0 30 L30 0 M22 38 L38 22" stroke="${fg}" stroke-width="5"/>` }),
  grid: (fg) => ({ w: 36, h: 36, body: `<path d="M36 0 H0 V36" fill="none" stroke="${fg}" stroke-width="2"/>` }),
  waves: (fg) => ({ w: 80, h: 30, body: `<path d="M0 15 Q20 0 40 15 T80 15" fill="none" stroke="${fg}" stroke-width="3"/>` }),
  chevron: (fg) => ({ w: 48, h: 30, body: `<path d="M0 22 L24 6 L48 22" fill="none" stroke="${fg}" stroke-width="5"/>` }),
  confetti: (fg) => ({ w: 90, h: 90, body: `<rect x="8" y="10" width="10" height="4" rx="2" fill="${fg}" transform="rotate(25 13 12)"/><circle cx="60" cy="18" r="4" fill="${fg}"/><path d="M40 55 l8 0 l-4 8 z" fill="${fg}"/><rect x="70" y="60" width="12" height="4" rx="2" fill="${fg}" transform="rotate(-30 76 62)"/><circle cx="18" cy="72" r="3" fill="${fg}"/>` }),
  leaves: (fg) => ({ w: 70, h: 70, body: `<path d="M15 45 C15 25 35 15 45 15 C45 35 35 45 15 45 Z" fill="${fg}"/><path d="M15 45 L40 20" stroke="#ffffff" stroke-opacity=".5" stroke-width="1.5"/><path d="M50 65 C50 55 60 48 66 48 C66 58 60 65 50 65 Z" fill="${fg}"/>` }),
  circles: (fg) => ({ w: 60, h: 60, body: `<circle cx="30" cy="30" r="20" fill="none" stroke="${fg}" stroke-width="3"/>` }),
  crosshatch: (fg) => ({ w: 24, h: 24, body: `<path d="M0 0 L24 24 M24 0 L0 24" stroke="${fg}" stroke-width="1.5"/>` }),
};
/** A full-card background pattern as an SVG data URL. `strength` is the pattern's opacity (0.1 to 1). */
export function patternSvg(kind: PatternKind, bg: string, fg: string, strength = 0.35): string {
  const t = TILE[kind](fg);
  const a = Math.max(0.1, Math.min(1, strength));
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}"><defs><pattern id="p" width="${t.w}" height="${t.h}" patternUnits="userSpaceOnUse">${t.body}</pattern></defs><rect width="100%" height="100%" fill="${bg}"/><rect width="100%" height="100%" fill="url(#p)" opacity="${a}"/></svg>`);
}

/** The pattern behind everything on a side is an image element whose id starts with this. */
export const PATTERN_ID = 'bgpat';
export const isPattern = (e: { id: string; type: string }) => e.type === 'image' && e.id.startsWith(PATTERN_ID);
/** Put a pattern behind a side (replacing any pattern already there). The side's color becomes the pattern's background. */
export function setPattern(side: Side, kind: PatternKind, bg: string, fg: string): Side {
  const el: ImageEl = { id: `${PATTERN_ID}${uid()}`.slice(0, 24), type: 'image', x: 0, y: 0, w: CARD_W, h: CARD_H, href: patternSvg(kind, bg, fg) };
  return { bg, elements: [el, ...side.elements.filter((e) => !isPattern(e))] };
}
export const clearPattern = (side: Side): Side => ({ ...side, elements: side.elements.filter((e) => !isPattern(e)) });

// ---- graphics: icons and shapes -----------------------------------------------------------------------
// Icons are drawn on a 24x24 grid with strokes, in the color the customer picks.
export const ICONS: Record<string, { name: string; body: string }> = {
  phone: { name: 'Phone', body: '<path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>' },
  email: { name: 'Email', body: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>' },
  web: { name: 'Website', body: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' },
  pin: { name: 'Location', body: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>' },
  star: { name: 'Star', body: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>' },
  heart: { name: 'Heart', body: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>' },
  check: { name: 'Check', body: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>' },
  house: { name: 'House', body: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>' },
  car: { name: 'Car', body: '<path d="M3 16v-3l2-5h14l2 5v3z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>' },
  wrench: { name: 'Wrench', body: '<path d="M14 7a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 0-2-2z"/>' },
  hammer: { name: 'Hammer', body: '<path d="M14 4l6 6-3 3-6-6z"/><path d="M12 9l-8 8 3 3 8-8"/>' },
  leaf: { name: 'Leaf', body: '<path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z"/><path d="M5 19L14 10"/>' },
  food: { name: 'Fork & knife', body: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 2-2 6 0 8v10"/>' },
  scissors: { name: 'Scissors', body: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5L20 19M8.5 15.5L20 5"/>' },
  medical: { name: 'Medical', body: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 7v10M7 12h10"/>' },
  coffee: { name: 'Coffee', body: '<path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v3M12 3v3"/>' },
  camera: { name: 'Camera', body: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>' },
  paw: { name: 'Paw', body: '<circle cx="6" cy="10" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="18" cy="10" r="2"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/>' },
  music: { name: 'Music', body: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>' },
  truck: { name: 'Truck', body: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>' },
  cart: { name: 'Cart', body: '<path d="M3 4h2l2 11h12l2-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>' },
  briefcase: { name: 'Briefcase', body: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>' },
  cross: { name: 'Church cross', body: '<path d="M12 3v18M7 8h10"/>' },
  cake: { name: 'Cake', body: '<path d="M4 20h16v-7H4z"/><path d="M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0"/><path d="M12 13V9M12 6v.5"/>' },
};
export function iconSvg(key: string, color: string): string {
  const ic = ICONS[key] ?? ICONS.star;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic.body}</svg>`);
}
export const SHAPES: Record<string, { name: string; inner: (c: string) => string }> = {
  circle: { name: 'Circle', inner: (c) => `<circle cx="50" cy="50" r="50" fill="${c}"/>` },
  square: { name: 'Square', inner: (c) => `<rect width="100" height="100" fill="${c}"/>` },
  rounded: { name: 'Rounded box', inner: (c) => `<rect width="100" height="100" rx="18" fill="${c}"/>` },
  ring: { name: 'Ring', inner: (c) => `<circle cx="50" cy="50" r="46" fill="none" stroke="${c}" stroke-width="8"/>` },
  triangle: { name: 'Triangle', inner: (c) => `<polygon points="50,0 100,100 0,100" fill="${c}"/>` },
  diamond: { name: 'Diamond', inner: (c) => `<polygon points="50,0 100,50 50,100 0,50" fill="${c}"/>` },
  line: { name: 'Line', inner: (c) => `<rect y="44" width="100" height="12" fill="${c}"/>` },
  frame: { name: 'Frame', inner: (c) => `<rect x="4" y="4" width="92" height="92" fill="none" stroke="${c}" stroke-width="8"/>` },
};
export function shapeSvg(key: string, color: string): string {
  const s = SHAPES[key] ?? SHAPES.circle;
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${s.inner(color)}</svg>`);
}
/** A new graphic element in the middle of the card. Lines are wide and thin; everything else square. */
export function graphicEl(kind: 'icon' | 'shape', key: string, color: string): ImageEl {
  const line = kind === 'shape' && key === 'line';
  const w = line ? 400 : 120, h = line ? 24 : 120;
  return { id: `g${uid()}`.slice(0, 24), type: 'image', x: Math.round((CARD_W - w) / 2), y: Math.round((CARD_H - h) / 2), w, h, href: kind === 'icon' ? iconSvg(key, color) : shapeSvg(key, color) };
}

/** Is this a side with nothing on it yet (a pattern alone still counts as empty)? */
export const sideEmpty = (d: Design, s: 'front' | 'back') => d[s].elements.every((e) => isPattern(e));
