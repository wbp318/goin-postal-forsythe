export const prerender = false;
import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { readSession } from '../../lib/session';
import { getCustomer, bumpCounter } from '../../shipping/store';
import { TEMPLATES, PALETTES } from '../../lib/cards';
import { PATTERNS, ICONS } from '../../lib/cardArt';
import { validateSpec, demoSpecs, aiCatalog, type AiSpec } from '../../lib/cardDesign';

// "Design with AI" for business cards (Peter, Nov 15 2026). A signed-in customer describes their card; the
// answer is three design specs built only from the store's own layouts, colors, patterns and icons, which the
// designer turns into editable cards. Nothing is drawn by the AI and nothing is ordered here.
//  - No ANTHROPIC_API_KEY: demo mode. Designs are picked by matching words in the request. No AI, no cost.
//  - With a key: Claude writes the specs (structured output, checked again by validateSpec). About 2 cents a try.
// A daily limit per customer (AI_DAILY_LIMIT, default 10) keeps the bill predictable; demo tries count too, so
// the limit can be seen working before any money is spent.
const MODEL = 'claude-opus-5-5';

const DETAIL_KEYS = ['name', 'title', 'company', 'phone', 'email', 'website', 'address', 'tagline'] as const;
const SCHEMA = {
  type: 'object',
  properties: {
    designs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          template: { type: 'string', enum: TEMPLATES.map((t) => t.id) },
          palette: { type: 'integer', enum: PALETTES.map((_, i) => i) },
          pattern: { anyOf: [{ type: 'null' }, { type: 'object', properties: { kind: { type: 'string', enum: PATTERNS.map((p) => p.kind) }, bg: { type: 'string' }, fg: { type: 'string' } }, required: ['kind', 'bg', 'fg'], additionalProperties: false }] },
          icon: { anyOf: [{ type: 'null' }, { type: 'string', enum: Object.keys(ICONS) }] },
          details: { type: 'object', properties: Object.fromEntries(DETAIL_KEYS.map((k) => [k, { type: 'string' }])), required: [...DETAIL_KEYS], additionalProperties: false },
          why: { type: 'string' },
        },
        required: ['template', 'palette', 'pattern', 'icon', 'details', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['designs'],
  additionalProperties: false,
};

const SYSTEM = `You design business cards for customers of Goin' Postal Forsythe, a print and shipping store in Monroe, Louisiana.
The customer describes their business and the look they want. Reply with exactly three different designs, built only from this catalog:
${JSON.stringify(aiCatalog())}

Rules:
- template, palette, pattern kind and icon must come from the catalog. pattern is null for a plain background; when used, bg and fg are 6-digit hex colors with enough contrast that text on the card stays easy to read (a light bg with a mid-tone fg works best).
- details: fill in only what the customer actually told you (business name, their name, title, phone, email, website, address). Leave the rest as an empty string; never invent phone numbers, emails, websites or addresses. You may write a short tagline (under 8 words) if it suits the business.
- Never use another company's name, logo, slogan or trademark, and nothing offensive or adult. If the request asks for that, make plain professional designs instead.
- Make the three designs genuinely different (layout, colors, pattern). "why" is one short sentence to the customer about the idea.`;

export const POST: APIRoute = async ({ request }) => {
  try {
    const meId = await readSession(env, request.headers.get('cookie')).catch(() => null);
    const me = meId ? await getCustomer(env, meId) : null;
    if (!me) return json({ error: 'Sign in to design with AI.', signin: true }, 401);
    const b: any = await request.json().catch(() => ({}));
    const prompt = String(b.prompt ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
    if (prompt.length < 3) return json({ error: 'Tell us a little about your business and the look you want.' }, 400);

    // Each try is counted first, in one atomic step, per customer and for the whole site (AI_SITE_DAILY_LIMIT,
    // default 200 a day), so the bill has a ceiling however the requests arrive.
    const limit = Math.max(1, Number(env.AI_DAILY_LIMIT) || 10);
    const siteLimit = Math.max(1, Number(env.AI_SITE_DAILY_LIMIT) || 200);
    const day = new Date().toISOString().slice(0, 10);
    const [used, siteUsed] = await Promise.all([bumpCounter(env, `ai:${me.id}:${day}`, 60 * 60 * 48), bumpCounter(env, `ai:all:${day}`, 60 * 60 * 48)]);
    if (used > limit) return json({ error: `That's ${limit} AI designs today. Try again tomorrow, or edit one of the designs you have.`, limited: true }, 429);
    if (siteUsed > siteLimit) return json({ error: 'The design assistant has done all it can for today. Try again tomorrow, or pick a design from the gallery.', limited: true }, 429);
    const left = Math.max(0, limit - used);

    if (!env.ANTHROPIC_API_KEY) return json({ designs: demoSpecs(prompt), demo: true, left });

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    let response;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return json({ error: 'The design assistant is busy. Try again in a minute.' }, 503);
      if (e instanceof Anthropic.APIError) return json({ error: 'The design assistant is not available right now. Pick a design from the gallery instead.' }, 503);
      throw e;
    }
    if (response.stop_reason === 'refusal') return json({ error: "We couldn't design that one. Try describing your business differently.", left });
    const text = response.content.find((c: any) => c.type === 'text') as { text: string } | undefined;
    let designs: AiSpec[] = [];
    try { designs = (JSON.parse(text?.text ?? '{}').designs ?? []).slice(0, 3).map(validateSpec); } catch { designs = []; }
    if (!designs.length) return json({ error: "We couldn't come up with designs this time. Try again or reword it.", left });
    return json({ designs, demo: false, left });
  } catch (e: any) {
    return json({ error: e.message ?? 'Try again' }, 500);
  }
};
