// Physical mailboxes on the website (Peter, Nov 15 2026): sizes, prices, box numbers, the address, the
// paid-through date and the renewal reminders. Pure functions; the owners edit src/data/mailboxes.json.
// The counter's LibreOffice register (physical-mailbox/) stays the full record of IDs and the PS Form 1583;
// this is what the website needs to take reservations, show a holder their box, and send reminders.
import cfg from '../data/mailboxes.json';

export type SizeId = 'small' | 'medium' | 'large';
export type Term = 6 | 12;
export interface MailboxSize { id: SizeId; name: string; from: number; to: number; price6: number; price12: number; capacity: number }
export const SIZES = cfg.sizes as MailboxSize[];
export const TERMS: Term[] = [6, 12];
export const REMINDER_DAYS: number[] = [...cfg.reminder_days].sort((a, b) => b - a); // e.g. [60, 30, 7]

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

/** The words of a reminder, for a text and an email. Plain English; the store's phone number, and the renew-online link when there is one. */
export function reminderText(b: { box_no: number; paid_through: string }, key: string, store: { name: string; phone: string }, renewUrl: string | null = null, auto: { amount: number; last4: string; term: number } | null = null) {
  const stage = key.split(':')[1];
  const when = new Date(b.paid_through + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const holdUntil = new Date(addMonths(b.paid_through, HOLD_MONTHS) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const sms = stage === 'over'
    ? `${store.name}: your mailbox #${b.box_no} expired on ${when}. We'll hold your mail until ${holdUntil}, then return it to sender. Renew ${renewUrl ? `online at ${renewUrl} or ` : ''}at the counter. Questions: ${store.phone}`
    : `${store.name}: your mailbox #${b.box_no} is paid through ${when}. Renew ${renewUrl ? `online at ${renewUrl} or ` : ''}at the counter any time before then. Questions: ${store.phone}`;
  if (auto && stage !== 'over') {
    // Peter, Nov 16 2026: spell out that it renews unless they turn it off, so there's a clear paper trail.
    const plan = `${auto.term === 12 ? '1 year' : '6 months'}`;
    const line = `unless you turn it off, your mailbox #${b.box_no} renews automatically on ${when} for $${auto.amount.toFixed(2)} (${plan}, the same plan as now), charged to your card ending ${auto.last4}.`;
    return {
      sms: `${store.name}: ${line[0].toUpperCase()}${line.slice(1)} To stop it: ${renewUrl ?? 'tell us at the counter'}. Questions: ${store.phone}`,
      subject: `Your mailbox #${b.box_no} renews automatically on ${when}`,
      email: [
        `Hi! ${line[0].toUpperCase()}${line.slice(1)}`, '',
        'To keep your box, there is nothing to do.', '',
        `If you do NOT want it to renew, turn off automatic renewal before ${when} on your mailbox dashboard${renewUrl ? ` (${renewUrl})` : ''} or tell us at the counter. Mail for a box that isn't renewed is held for 6 months and then returned to the sender.`, '',
        `Questions? Call us at ${store.phone}.`,
      ].join('\n'),
    };
  }
  const subject = stage === 'over' ? `Your mailbox #${b.box_no} has expired` : `Your mailbox #${b.box_no} renews soon`;
  const email = [
    stage === 'over' ? `Your mailbox #${b.box_no} at ${store.name} expired on ${when}.` : `Your mailbox #${b.box_no} at ${store.name} is paid through ${when}.`,
    '',
    stage === 'over' ? `We'll hold your mail and packages until ${holdUntil}. After that they go back to the sender. Renew to keep them coming to your box.` : 'Renew for 6 months or a year any time before then, at the counter or online.',
    ...(renewUrl ? ['', `Renew online: ${renewUrl}`] : []),
    '',
    `Questions? Call us at ${store.phone}.`,
  ].join('\n');
  return { sms, subject, email };
}

// ---- After a box ends (Peter, Nov 16 2026) ---------------------------------------------------------------
// A box ends when it expires (not renewed by its paid-through date) or when staff close it. The store keeps that
// holder's mail for HOLD_MONTHS, then returns it to sender; the box stays on the staff Expired list for KEEP_MONTHS.
export const HOLD_MONTHS: number = (cfg as any).hold_months ?? 6;
export const KEEP_MONTHS: number = (cfg as any).keep_months ?? 12;

/** The day a box's service ended: the day it was closed, or its paid-through date if it lapsed. Null while paid. */
export function endedOn(b: { status: string; paid_through: string; closed_at: string | null }, today: string): string | null {
  if (b.status === 'closed') return b.closed_at ? b.closed_at.slice(0, 10) < b.paid_through ? b.closed_at.slice(0, 10) : b.paid_through : b.paid_through;
  return b.paid_through < today ? b.paid_through : null;
}

export type MailAction = { do: 'box' } | { do: 'hold'; ended: string; until: string } | { do: 'rts'; ended: string; since: string };
/**
 * What to do with mail for this box today: put it in the box (paid), hold it (ended less than HOLD_MONTHS ago;
 * "until" is the last day to hold), or return to sender (the hold is over; "since" is the first RTS day).
 */
export function mailAction(b: { status: string; paid_through: string; closed_at: string | null }, today: string): MailAction {
  const ended = endedOn(b, today);
  if (!ended) return { do: 'box' };
  const until = addMonths(ended, HOLD_MONTHS);
  if (today <= until) return { do: 'hold', ended, until };
  return { do: 'rts', ended, since: day(new Date(Date.parse(until + 'T00:00:00Z') + 86_400_000)) };
}
/** Whether an ended box still belongs on the staff Expired list (KEEP_MONTHS after it ended). */
export const onExpiredList = (b: { status: string; paid_through: string; closed_at: string | null }, today: string) => {
  const ended = endedOn(b, today);
  return !!ended && today <= addMonths(ended, KEEP_MONTHS);
};

// ---- The mail log: capacity and overage (Peter, Nov 16 2026) -------------------------------------------
/** Each piece that arrives while a box is already full costs this much. */
export const OVERAGE_FEE: number = (cfg as any).overage_fee ?? 0.45;
/** Overages are charged to the card once they add up to this (Stripe's smallest charge is 50 cents). */
export const MIN_CHARGE: number = (cfg as any).min_charge ?? 0.5;
export const capacityFor = (size: string) => sizeById(size)?.capacity ?? 0;
/** How full a box is: pieces in it, its capacity, the percent (can pass 100), and whether a new piece is an overage. */
export function fullness(pieces: number, size: string) {
  const cap = capacityFor(size);
  const pct = cap ? Math.round((pieces / cap) * 100) : 0;
  return { pieces, capacity: cap, pct, full: cap > 0 && pieces >= cap, over: cap > 0 ? Math.max(0, pieces - cap) : 0 };
}
export const money = (n: number) => `$${n.toFixed(2)}`;

// ---- Packages (Peter, Nov 16 2026): they don't fill the box; they have their own limits -----------------
export const PKG = {
  freeCount: (cfg as any).package_free_count ?? 2,
  fee: (cfg as any).package_fee ?? 2,
  feeAfterDays: (cfg as any).package_fee_after_days ?? 2,
  freeDays: (cfg as any).package_free_days ?? 5,
  storagePerDay: (cfg as any).storage_fee_per_day ?? 1,
  remindDay: (cfg as any).package_remind_day ?? 4,
  storageCap: (cfg as any).storage_cap ?? 10,
  returnNoticeDay: (cfg as any).package_return_notice_day ?? 30,
  returnAfter: (cfg as any).package_return_after_notice_days ?? 3,
};
/** Whole days a piece has been here (0 on the day it came in). */
export const daysHeld = (arrivedAt: string, today: string) => Math.max(0, daysBetween(arrivedAt.slice(0, 10), today));
/** The last free day for a package (it came in on day 0). */
export const freeUntil = (arrivedAt: string) => day(new Date(Date.parse(arrivedAt.slice(0, 10) + 'T00:00:00Z') + PKG.freeDays * 86_400_000));

/**
 * The package fees a box owes today that aren't charged yet. packages: the ones still here, oldest first.
 * charged: markers already charged ("<id>:extra", "<id>:storage:<n>"). A package past the free count (by arrival
 * order among those still here) owes the extra-package fee once it has been here feeAfterDays; every package owes
 * storage for each day past freeDays.
 */
export function packageFeesDue(packages: { id: number; arrived_at: string }[], charged: Set<string>, today: string) {
  const out: { item_id: number; marker: string; amount: number; what: 'package' | 'storage'; label: string }[] = [];
  packages.forEach((p, i) => {
    const held = daysHeld(p.arrived_at, today);
    if (i >= PKG.freeCount && held >= PKG.feeAfterDays && !charged.has(`${p.id}:extra`))
      out.push({ item_id: p.id, marker: `${p.id}:extra`, amount: PKG.fee, what: 'package', label: `Package ${i + 1} at a time (more than ${PKG.freeCount}), here ${held} days` });
    const days = Math.min(held - PKG.freeDays, Math.floor(PKG.storageCap / PKG.storagePerDay));
    for (let n = 1; n <= days; n++)
      if (!charged.has(`${p.id}:storage:${n}`)) out.push({ item_id: p.id, marker: `${p.id}:storage:${n}`, amount: PKG.storagePerDay, what: 'storage', label: `Package storage, day ${PKG.freeDays + n}` });
  });
  return out;
}
/** The day staff should return an unclaimed package to the sender. */
export const returnOn = (arrivedAt: string) => day(new Date(Date.parse(arrivedAt.slice(0, 10) + 'T00:00:00Z') + (PKG.returnNoticeDay + PKG.returnAfter) * 86_400_000));
/** One package's state today: free, the extra-package fee, storage so far (capped), and whether to return it. */
export function packageState(p: { arrived_at: string }, indexInBox: number, today: string) {
  const held = daysHeld(p.arrived_at, today);
  const storage = Math.min(Math.max(0, held - PKG.freeDays) * PKG.storagePerDay, PKG.storageCap);
  const extra = indexInBox >= PKG.freeCount && held >= PKG.feeAfterDays ? PKG.fee : 0;
  return { held, free_until: freeUntil(p.arrived_at), storage, extra, return_on: returnOn(p.arrived_at), rts: today >= returnOn(p.arrived_at), late: held > PKG.freeDays };
}

// ---- Keeping the letter count right (Peter, Nov 16 2026) ------------------------------------------------
// Staff answer "is it empty?" on the first letter of the day (key "<day>:checked"), from the Check these boxes list
// for quiet boxes, or after the holder taps "I picked up my mail" (key "claim:<day>", which never clears anything
// by itself: staff confirm it).
export const CHECK_EVERY_DAYS: number = (cfg as any).check_every_days ?? 14;
export const lastChecked = (keys: string[]) => keys.filter((k) => k.endsWith(':checked')).map((k) => k.slice(0, 10)).sort().at(-1) ?? null;
export const pendingClaim = (keys: string[]) => keys.filter((k) => k.startsWith('claim:')).map((k) => k.slice(6)).sort().at(-1) ?? null;
/** Why a box with letters should be looked at today, or null: the holder says they emptied it, or it's been quiet a while. */
export function checkReason(letters: number, firstLetter: string | null, keys: string[], today: string): { why: 'claim'; since: string } | { why: 'quiet'; since: string } | null {
  if (letters <= 0) return null;
  const claim = pendingClaim(keys);
  if (claim) return { why: 'claim', since: claim };
  const last = lastChecked(keys);
  const oldest = firstLetter ? firstLetter.slice(0, 10) : null;
  if (oldest && daysBetween(oldest, today) >= CHECK_EVERY_DAYS && (!last || daysBetween(last, today) >= CHECK_EVERY_DAYS)) return { why: 'quiet', since: oldest };
  return null;
}
