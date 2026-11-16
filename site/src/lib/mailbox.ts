// Physical mailboxes on the website (Peter, Nov 15 2026): sizes, prices, box numbers, the address, the
// paid-through date and the renewal reminders. Pure functions; the owners edit src/data/mailboxes.json.
// The counter's LibreOffice register (physical-mailbox/) stays the full record of IDs and the PS Form 1583;
// this is what the website needs to take reservations, show a holder their box, and send reminders.
import cfg from '../data/mailboxes.json';

export type SizeId = 'small' | 'medium' | 'large';
export type Term = 6 | 12;
export interface MailboxSize { id: SizeId; name: string; from: number; to: number; price6: number; price12: number }
export const SIZES = cfg.sizes as MailboxSize[];
export const TERMS: Term[] = [6, 12];
export const REMINDER_DAYS: number[] = [...cfg.reminder_days].sort((a, b) => b - a); // e.g. [30, 7]

export const sizeById = (id: string) => SIZES.find((s) => s.id === id) ?? null;
/** Which size a box number belongs to, or null when it's in no range. */
export const sizeForBox = (box: number) => SIZES.find((s) => Number.isInteger(box) && box >= s.from && box <= s.to) ?? null;
export const isTerm = (t: unknown): t is Term => t === 6 || t === 12;
export const priceFor = (size: SizeId, term: Term) => { const s = sizeById(size); return s ? (term === 6 ? s.price6 : s.price12) : null; };
/** The street address a holder gives out, with their box number. */
export const addressFor = (box: number) => cfg.address.replace('{box}', String(box));

/** YYYY-MM-DD for a date (UTC calendar day). */
export const day = (d: Date) => d.toISOString().slice(0, 10);
/** A date some whole months later; the 31st becomes the last day of a shorter month. */
export function addMonths(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return day(target);
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);
export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

export type BoxStatus = 'current' | 'due_soon' | 'overdue' | 'closed';
/** Current, due soon (within the first reminder window), overdue (past the paid-through date), or closed. */
export function boxStatus(b: { status: string; paid_through: string }, today: string): BoxStatus {
  if (b.status === 'closed') return 'closed';
  const left = daysBetween(today, b.paid_through);
  if (left < 0) return 'overdue';
  return left <= (REMINDER_DAYS[0] ?? 30) ? 'due_soon' : 'current';
}

/**
 * The reminder due today, if any: one per reminder window ("30", "7") and one the day after the box lapses
 * ("over"), each sent once per paid-through date (keys look like "2027-05-15:7"). A later window that is
 * already due replaces an earlier one that was missed, so a holder never gets two at once.
 */
export function dueReminder(b: { status: string; paid_through: string; reminders: string[] }, today: string): string | null {
  if (b.status === 'closed') return null;
  const left = daysBetween(today, b.paid_through);
  const sent = new Set(b.reminders);
  let stage: string | null = null;
  if (left < 0) stage = left >= -30 ? 'over' : null; // a month after it lapsed, the counter calls instead
  else for (const n of REMINDER_DAYS) if (left <= n) stage = String(n); // the smallest window reached
  if (!stage) return null;
  const key = `${b.paid_through}:${stage}`;
  return sent.has(key) ? null : key;
}

/** The words of a reminder, for a text and an email. Plain English; the store's phone number for questions. */
export function reminderText(b: { box_no: number; paid_through: string }, key: string, store: { name: string; phone: string }) {
  const stage = key.split(':')[1];
  const when = new Date(b.paid_through + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const sms = stage === 'over'
    ? `${store.name}: your mailbox #${b.box_no} expired on ${when}. Renew at the counter to keep your mail coming. Questions: ${store.phone}`
    : `${store.name}: your mailbox #${b.box_no} is paid through ${when}. Renew at the counter any time before then. Questions: ${store.phone}`;
  const subject = stage === 'over' ? `Your mailbox #${b.box_no} has expired` : `Your mailbox #${b.box_no} renews soon`;
  const email = [
    stage === 'over' ? `Your mailbox #${b.box_no} at ${store.name} expired on ${when}.` : `Your mailbox #${b.box_no} at ${store.name} is paid through ${when}.`,
    '',
    stage === 'over' ? 'Stop by the counter to renew so your mail and packages keep coming to your box.' : 'Stop by the counter any time before then to renew for 6 months or a year.',
    '',
    `Questions? Call us at ${store.phone}.`,
  ].join('\n');
  return { sms, subject, email };
}
