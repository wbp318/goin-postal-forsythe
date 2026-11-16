// Building and rebuilding card designs (Peter, Nov 15 2026):
//  - the editor's Templates tool switches layout or colors while keeping what the customer already typed and
//    the pictures they added;
//  - "Design with AI" turns a short design spec (layout, colors, pattern, icon, wording) into a real card.
// The spec only ever names pieces from the store's own catalog (lib/cards.ts layouts and palettes, lib/cardArt.ts
// patterns and icons), and validateSpec() throws away anything else, whether it came from the AI or a demo.
// Pure functions, no DOM.
import { makeTemplate, PALETTES, TEMPLATES, CARD_W, SAFE, type Design, type Details, type TemplateId, type Side } from './cards';
import { PATTERNS, ICONS, BG_COLORS, setPattern, isPattern, iconSvg, type PatternKind } from './cardArt';
import { BUSINESS_TYPES } from './cardShop';

/** The placeholder wording a fresh layout starts with; the customer types over it. */
export const BLANK: Details = { name: 'Your Name', title: 'Your Title', company: 'Company Name', phone: '(000) 000-0000', email: 'you@example.com', website: 'yourwebsite.com', address: 'Street, City, State', tagline: 'Your tagline here' };
const FIELDS = Object.keys(BLANK) as (keyof Details)[];
const blankField = (line: string) => FIELDS.find((k) => BLANK[k] === line.trim());

/** What the customer has typed on the card so far, field by field (placeholders where they haven't). */
export function detailsFromDesign(d: Design): Details {
  const out: Details = { ...BLANK };
  const fresh = makeTemplate(d.template, PALETTES[0], BLANK, true);
  for (const s of ['front', 'back'] as const) {
    const was = fresh[s].elements.filter((e) => e.type === 'text');
    const now = d[s].elements.filter((e) => e.type === 'text');
    was.forEach((w, i) => {
      const n = now[i];
      if (!n || n.type !== 'text' || w.type !== 'text' || n.placeholder) return;
      const wl = w.text.split('\n'), nl = n.text.split('\n');
      if (wl.length === 1) { const k = blankField(wl[0]); if (k) out[k] = n.text.trim(); return; }
      wl.forEach((line, j) => { const k = blankField(line); if (k && nl[j] && nl[j].trim()) out[k] = nl[j].trim(); });
    });
  }
  return out;
}

/** A layout with the customer's details: text that isn't a placeholder any more stops being drawn grey. */
export function buildCard(t: TemplateId, palette: number, details: Details): Design {
  const d = makeTemplate(t, PALETTES[palette] ?? PALETTES[0], details, true);
  for (const s of ['front', 'back'] as const) for (const e of d[s].elements) {
    if (e.type === 'text' && e.text.split('\n').some((line) => !blankField(line))) e.placeholder = false;
  }
  return d;
}

/** Switch layout or colors, keeping the customer's words, their own pictures and any background pattern. */
export function swapTemplate(d: Design, t: TemplateId, palette: number): Design {
  const next = buildCard(t, palette, detailsFromDesign(d));
  next.font = d.font;
  for (const s of ['front', 'back'] as const) {
    // The layout's own colored shapes are redrawn by the new layout. What the customer added is carried over:
    // pictures they uploaded (PNG/JPEG, or an id starting with "u") and graphics (an id starting with "g").
    const kept = d[s].elements.filter((e) => e.type === 'image' && !isPattern(e) && (/^data:image\/(png|jpeg)/.test(e.href) || e.id.startsWith('g') || e.id.startsWith('u')));
    const pattern = d[s].elements.find((e) => isPattern(e));
    next[s] = { bg: pattern ? d[s].bg : next[s].bg, elements: [...(pattern ? [pattern] : []), ...next[s].elements, ...kept] };
  }
  return next;
}

// ---- Design with AI ------------------------------------------------------------------------------------
export interface AiSpec {
  template: TemplateId;
  palette: number;
  pattern: { kind: PatternKind; bg: string; fg: string } | null;
  icon: string | null;
  details: Partial<Details>;
  why: string;
}
const HEX = /^#[0-9a-fA-F]{6}$/;
const clip = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

/** Keep only pieces from our own catalog and short, plain wording. Anything unknown falls back to safe defaults. */
export function validateSpec(raw: any): AiSpec {
  const template = TEMPLATES.some((t) => t.id === raw?.template) ? (raw.template as TemplateId) : 'classic';
  const palette = Number.isInteger(raw?.palette) && raw.palette >= 0 && raw.palette < PALETTES.length ? raw.palette : 0;
  const p = raw?.pattern;
  const pattern = p && PATTERNS.some((x) => x.kind === p.kind) && HEX.test(p.bg) && HEX.test(p.fg) ? { kind: p.kind as PatternKind, bg: p.bg, fg: p.fg } : null;
  const icon = typeof raw?.icon === 'string' && ICONS[raw.icon] ? raw.icon : null;
  const details: Partial<Details> = {};
  for (const k of FIELDS) { const v = clip(raw?.details?.[k], k === 'tagline' || k === 'address' ? 60 : 40); if (v) details[k] = v; }
  return { template, palette, pattern, icon, details, why: clip(raw?.why, 140) };
}

/** Turn a spec into a card the customer can edit. Wording the AI didn't fill in stays as grey sample text. */
export function cardFromSpec(spec: AiSpec): Design {
  const d = buildCard(spec.template, spec.palette, { ...BLANK, ...spec.details });
  if (spec.pattern) d.front = setPattern(d.front, spec.pattern.kind, spec.pattern.bg, spec.pattern.fg);
  if (spec.icon) {
    const size = 84;
    d.front.elements.push({ id: `g${Math.random().toString(36).slice(2, 10)}`, type: 'image', x: CARD_W - SAFE - size, y: SAFE, w: size, h: size, href: iconSvg(spec.icon, PALETTES[spec.palette].accent) });
  }
  return d;
}

/** The catalog the AI is told it may choose from (kept short: ids and names only). */
export function aiCatalog() {
  return {
    templates: TEMPLATES.map((t) => t.id),
    palettes: PALETTES.map((p, i) => ({ index: i, name: p.name, accent: p.accent })),
    patterns: PATTERNS.map((p) => p.kind),
    icons: Object.keys(ICONS),
    background_colors: BG_COLORS,
  };
}

// ---- demo mode: no API key, so no AI. A word match picks designs, so the owners can see the flow. --------
const COLOR_WORDS: [RegExp, number][] = [
  [/\bnavy|dark blue\b/i, 0], [/\bkraft|brown|rustic\b/i, 1], [/\bblue\b/i, 2], [/\bblack|bold|sleek\b/i, 3], [/\bgreen|forest|nature\b/i, 4],
  [/\bred|wine|burgundy\b/i, 5], [/\bteal|aqua\b/i, 6], [/\borange|sunset|warm\b/i, 7], [/\bgr[ae]y|slate|modern\b/i, 8], [/\bpink|rose\b/i, 9], [/\bgold|yellow|elegant|luxury\b/i, 10], [/\bsky|light blue\b/i, 11],
];
const TYPE_WORDS: [RegExp, string, string][] = [
  [/restaurant|food|kitchen|cafe|café|bakery|crawfish|bbq|catering|chef/i, 'restaurant', 'food'],
  [/salon|beauty|hair|nail|barber|spa|lash|makeup/i, 'beauty', 'scissors'],
  [/construct|contractor|roof|plumb|electric|builder|handyman|trade/i, 'trades', 'hammer'],
  [/real estate|realtor|realty|homes?\b|property/i, 'realestate', 'house'],
  [/auto|car|mechanic|repair|tire|detail/i, 'auto', 'wrench'],
  [/lawn|landscap|garden|mow|tree/i, 'lawn', 'leaf'],
  [/church|ministry|pastor|nonprofit|charity/i, 'church', 'cross'],
  [/doctor|clinic|medical|dental|health|nurse|therapy/i, 'medical', 'medical'],
  [/coffee/i, 'restaurant', 'coffee'], [/photo/i, 'beauty', 'camera'], [/pet|dog|cat|groom|vet/i, 'beauty', 'paw'], [/music|dj|band/i, 'beauty', 'music'],
  [/truck|moving|delivery|haul/i, 'trades', 'truck'],
];
export function demoSpecs(prompt: string): AiSpec[] {
  const t = TYPE_WORDS.find(([re]) => re.test(prompt));
  const bt = BUSINESS_TYPES.find((b) => b.id === (t?.[1] ?? '')) ?? null;
  const color = COLOR_WORDS.find(([re]) => re.test(prompt))?.[1];
  const palette = color ?? bt?.palette ?? 0;
  const quoted = prompt.match(/["“]([^"”]{2,40})["”]/)?.[1] ?? prompt.match(/\b(?:called|named)\s+([A-Z][\w'&]*(?:\s+[A-Z][\w'&]*){0,4})/)?.[1];
  const details: Partial<Details> = quoted ? { company: quoted.trim() } : {};
  const layouts: TemplateId[] = bt ? [bt.template, ...(['band', 'split', 'corner', 'topbar', 'minimal', 'diagonal'] as TemplateId[]).filter((x) => x !== bt.template)] : ['classic', 'band', 'split'];
  const kinds: PatternKind[] = /leaf|garden|lawn|nature/i.test(prompt) ? ['leaves', 'dots', 'waves'] : /party|fun|kids|cake|celebrat/i.test(prompt) ? ['confetti', 'dots', 'circles'] : ['dots', 'waves', 'diagonal'];
  const accent = PALETTES[palette].accent;
  return [0, 1, 2].map((i) => validateSpec({
    template: layouts[i], palette, icon: t?.[2] ?? null, details,
    pattern: i === 1 ? { kind: kinds[0], bg: '#ffffff', fg: accent } : i === 2 ? { kind: kinds[1], bg: '#fbf7f0', fg: accent } : null,
    why: 'Demo: picked by matching words in your request (no AI yet).',
  }));
}
