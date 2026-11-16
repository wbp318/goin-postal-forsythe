// Saved business cards (Peter, Nov 15 2026): the small rules shared by the account API and the card order.
import { sanitizeDesign, QUANTITIES, CARD_OPTIONS, OPTION_GROUPS, type Design } from './cards';

/** Largest design kept on an account (pictures included). D1 allows 2 MB a row; this leaves room. */
export const SAVED_DESIGN_MAX = 1_500_000;

/** A cleaned design and its JSON, or an error a customer can read. */
export function designForSaving(raw: unknown): { design: Design; json: string } {
  const design = sanitizeDesign(raw);
  const json = JSON.stringify(design);
  if (json.length > SAVED_DESIGN_MAX) throw new Error('This card has too many large pictures to save. Use smaller pictures and try again.');
  return { design, json };
}

/** A name for the card on the account page: the customer's own name for it, else the first words they typed on the front. */
export function cardName(design: Design, given?: unknown): string {
  const own = String(given ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (own) return own;
  const first = design.front.elements.find((e) => e.type === 'text' && !e.placeholder && e.text.trim());
  const text = first && first.type === 'text' ? first.text.trim().split('\n')[0].slice(0, 60) : '';
  return text || 'My business card';
}

/** Only real option codes, one per group, for Reorder to tick again. */
export function cleanPicks(raw: unknown): Record<string, string> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const g of OPTION_GROUPS) { const v = String(r[g] ?? ''); if (CARD_OPTIONS.some((o) => o.group === g && o.code === v)) out[g] = v; }
  return out;
}

export const cleanQuantity = (q: unknown) => (QUANTITIES.includes(Number(q)) ? Number(q) : null);
