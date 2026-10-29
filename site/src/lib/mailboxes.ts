// Mailbox subscriptions (agenda items 24 and 29, monetization plan). A customer picks a box size and
// pays monthly or yearly through Stripe Checkout in subscription mode; Stripe renews it and emails the
// receipts. The box number is given at the counter once the two IDs and PS Form 1583 are done, because
// a Commercial Mail Receiving Agency may not hand out an address before that. Prices are always
// computed here from the table, never taken from the browser.
import sizesFile from '../data/mailboxes.json';

export type MailboxSizeId = 'small' | 'medium' | 'large';
export type MailboxTerm = 'monthly' | 'yearly';
export interface MailboxSize { id: MailboxSizeId; name: string; fits: string; monthly: number }
export const SIZES: MailboxSize[] = (sizesFile as { sizes: MailboxSize[] }).sizes;
/** A year costs this many months. 12 for the price of 10. */
export const YEAR_MONTHS = (sizesFile as { year_months: number }).year_months;

export const sizeById = (id: string) => SIZES.find((s) => s.id === id) ?? null;

/** What a size costs on a term: the monthly price, or the yearly one at YEAR_MONTHS months. */
export function priceMailbox(size: string, term: string): { size: MailboxSize; term: MailboxTerm; price: number } {
  const s = sizeById(size);
  if (!s) throw new Error('Pick a box size');
  const t: MailboxTerm = term === 'yearly' ? 'yearly' : 'monthly';
  const price = Math.round((t === 'yearly' ? s.monthly * YEAR_MONTHS : s.monthly) * 100) / 100;
  return { size: s, term: t, price };
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newMailboxCode() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return 'MB-' + Array.from(b, (x) => alphabet[x % alphabet.length]).join('');
}

/** Status labels the pages show. Stripe's subscription statuses are folded into these. */
export type MailboxStatus = 'awaiting_payment' | 'active' | 'past_due' | 'cancelled';
export function statusFromStripe(s: string): MailboxStatus {
  if (s === 'active' || s === 'trialing') return 'active';
  if (s === 'past_due' || s === 'unpaid' || s === 'incomplete') return 'past_due';
  return 'cancelled';
}
