// Business card rendering. Pure functions, no DOM, so the same code draws the live
// preview in the browser, the saved order on the server, and the print sheet at the counter.
// Card is 3.5 x 2 in. SVG units are points at 300 dpi: 1050 x 600, with a 0.125 in bleed guide.

export const CARD_W = 1050;
export const CARD_H = 600;
const SAFE = 56; // 0.1875 in safe margin

export type TemplateId = 'classic' | 'band' | 'minimal';
export type FontId = 'sans' | 'serif' | 'mono';

export interface Design {
  template: TemplateId;
  font: FontId;
  accent: string;     // hex
  ink: string;        // hex
  paper: string;      // hex
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  tagline: string;
  bandText: string;   // Band layout only: initials or a short word shown when there is no logo
  logo: string | null; // data: URL, PNG/JPG/SVG, capped at 400 KB
  back: 'none' | 'logo' | 'tagline';
}

export const TEMPLATES: { id: TemplateId; name: string; blurb: string }[] = [
  { id: 'classic', name: 'Classic', blurb: 'Centered name, details below, logo on top' },
  { id: 'band', name: 'Band', blurb: 'Color band down the left with the logo, details on the right' },
  { id: 'minimal', name: 'Minimal', blurb: 'Left-aligned, one thin rule, lots of white space' },
];

export const PALETTES = [
  { name: 'Navy and kraft', accent: '#0f1d3a', ink: '#17202d', paper: '#ffffff' },
  { name: 'Kraft', accent: '#b98a55', ink: '#17202d', paper: '#fbf7f0' },
  { name: 'Blue', accent: '#1d4ed8', ink: '#17202d', paper: '#ffffff' },
  { name: 'Black', accent: '#111111', ink: '#111111', paper: '#ffffff' },
  { name: 'Forest', accent: '#1f5f3b', ink: '#13261b', paper: '#ffffff' },
  { name: 'Wine', accent: '#7a1f2e', ink: '#2a1216', paper: '#fffaf9' },
];

export const DEFAULT_DESIGN: Design = {
  template: 'classic', font: 'sans',
  accent: PALETTES[0].accent, ink: PALETTES[0].ink, paper: PALETTES[0].paper,
  name: 'Rin Ho', title: 'Owner', company: "Goin' Postal Forsythe",
  phone: '(318) 000-0000', email: 'hello@example.com', website: 'goinpostalforsythe.com',
  address: 'Forsythe Ave & N 18th St, Monroe, LA', tagline: 'Ship it. Pack it. Print it.',
  bandText: 'GP',
  logo: null, back: 'logo',
};

const FONTS: Record<FontId, string> = {
  sans: "'Segoe UI', Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "Consolas, Menlo, monospace",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function text(x: number, y: number, s: string, size: number, opts: { weight?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; spacing?: number } = {}) {
  if (!s) return '';
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${opts.weight ?? 400}" fill="${opts.fill ?? 'currentColor'}" text-anchor="${opts.anchor ?? 'start'}" letter-spacing="${opts.spacing ?? 0}">${esc(s)}</text>`;
}

function logo(d: Design, x: number, y: number, w: number, h: number, center = false) {
  if (!d.logo) return '';
  const px = center ? x - w / 2 : x;
  return `<image href="${d.logo}" x="${px}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

function contactLines(d: Design): string[] {
  return [d.phone, d.email, d.website, d.address].filter(Boolean);
}

function front(d: Design): string {
  const c = contactLines(d);
  if (d.template === 'band') {
    const bandW = 360;
    return `
      <rect x="0" y="0" width="${bandW}" height="${CARD_H}" fill="${d.accent}"/>
      ${d.logo ? logo(d, bandW / 2, 150, 240, 240, true) : text(bandW / 2, 335, d.bandText, d.bandText.length > 3 ? 56 : 110, { weight: 800, fill: d.paper, anchor: 'middle', spacing: d.bandText.length > 3 ? 1 : 6 })}
      ${text(bandW + SAFE, 200, d.name, 56, { weight: 800 })}
      ${text(bandW + SAFE, 252, d.title, 30, { fill: d.accent, weight: 600, spacing: 2 })}
      ${text(bandW + SAFE, 300, d.company, 30, { weight: 600 })}
      ${c.map((s, i) => text(bandW + SAFE, 380 + i * 42, s, 26)).join('')}
    `;
  }
  if (d.template === 'minimal') {
    return `
      ${logo(d, SAFE, SAFE, 200, 110)}
      ${text(SAFE, d.logo ? 250 : 180, d.name, 60, { weight: 800 })}
      ${text(SAFE, d.logo ? 300 : 230, [d.title, d.company].filter(Boolean).join('  ·  '), 28, { fill: d.accent, weight: 600 })}
      <rect x="${SAFE}" y="${d.logo ? 340 : 280}" width="120" height="4" fill="${d.accent}"/>
      ${c.map((s, i) => text(SAFE, (d.logo ? 400 : 340) + i * 40, s, 25)).join('')}
    `;
  }
  // classic
  const top = d.logo ? 60 : 0;
  return `
    <rect x="0" y="0" width="${CARD_W}" height="18" fill="${d.accent}"/>
    ${logo(d, CARD_W / 2, 70, 300, 130, true)}
    ${text(CARD_W / 2, top + 230, d.name, 60, { weight: 800, anchor: 'middle' })}
    ${text(CARD_W / 2, top + 280, d.title, 28, { fill: d.accent, weight: 600, anchor: 'middle', spacing: 3 })}
    ${text(CARD_W / 2, top + 326, d.company, 30, { weight: 600, anchor: 'middle' })}
    ${c.map((s, i) => text(CARD_W / 2, top + 400 + i * 40, s, 25, { anchor: 'middle' })).join('')}
  `;
}

function back(d: Design): string {
  if (d.back === 'none') return '';
  const body = d.back === 'logo' && d.logo
    ? logo(d, CARD_W / 2, 150, 420, 300, true)
    : text(CARD_W / 2, CARD_H / 2 + 16, d.back === 'logo' ? d.company : d.tagline, 48, { weight: 700, fill: d.paper, anchor: 'middle' });
  return `<rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" fill="${d.accent}"/>${body}`;
}

export function renderCard(d: Design, side: 'front' | 'back', opts: { guides?: boolean } = {}): string {
  const inner = side === 'front' ? front(d) : back(d);
  if (side === 'back' && !inner) return '';
  const guides = opts.guides
    ? `<rect x="${SAFE}" y="${SAFE}" width="${CARD_W - 2 * SAFE}" height="${CARD_H - 2 * SAFE}" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-dasharray="12 10" opacity=".5"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" font-family="${FONTS[d.font]}" style="color:${d.ink}">
  <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" fill="${d.paper}"/>
  ${inner}
  ${guides}
</svg>`;
}

export function sanitizeDesign(v: any): Design {
  const s = (k: keyof Design, max = 80) => String(v?.[k] ?? '').slice(0, max);
  const hex = (k: keyof Design, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(String(v?.[k])) ? String(v[k]) : fallback);
  const logoRaw = typeof v?.logo === 'string' ? v.logo : null;
  const logoOk = logoRaw && /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logoRaw) && logoRaw.length < 400_000;
  return {
    template: (['classic', 'band', 'minimal'] as const).includes(v?.template) ? v.template : 'classic',
    font: (['sans', 'serif', 'mono'] as const).includes(v?.font) ? v.font : 'sans',
    accent: hex('accent', DEFAULT_DESIGN.accent), ink: hex('ink', DEFAULT_DESIGN.ink), paper: hex('paper', DEFAULT_DESIGN.paper),
    name: s('name'), title: s('title'), company: s('company'), phone: s('phone', 40), email: s('email'), website: s('website'), address: s('address', 120), tagline: s('tagline', 120), bandText: s('bandText', 12),
    logo: logoOk ? logoRaw : null,
    back: (['none', 'logo', 'tagline'] as const).includes(v?.back) ? v.back : 'none',
  };
}

export const QUANTITIES = [100, 250, 500, 1000];
// Shop prices. TODO owners: confirm per-quantity pricing.
export const PRICES: Record<number, number> = { 100: 24.99, 250: 39.99, 500: 59.99, 1000: 89.99 };
