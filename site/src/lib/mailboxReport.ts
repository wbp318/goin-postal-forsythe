// The mailbox report for Counter → Reports (Peter, Nov 16 2026): boxes, money taken through the website, mail
// handled and people, for any dates (a month, a quarter, a year). Pure: it takes the rows and does the sums, so it
// can be tested; /api/mailbox (action report) gathers the rows. Renewals paid at the register only show up here if
// staff used the Edit buttons; the register (physical-mailbox/) stays the full record of counter payments.
import { SIZES, mailAction, daysBetween } from './mailbox';
import type { MailboxRow, MailboxItem, MailboxCharge, MailboxRenewal, MailboxForward, MailboxReservation } from '../shipping/store';

const d10 = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
const inRange = (iso: string | null | undefined, from: string, to: string) => { const d = d10(iso); return !!d && d >= from && d <= to; };
const round = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: { amount: number }[]) => round(xs.reduce((a, x) => a + x.amount, 0));
/** A box is in use on a day when it had started and wasn't closed yet (an expired box still holds its number). */
const inUse = (b: MailboxRow, day: string) => b.start_date <= day && (!b.closed_at || d10(b.closed_at) > day);

export interface MailboxReportData { boxes: MailboxRow[]; items: MailboxItem[]; charges: MailboxCharge[]; renewals: MailboxRenewal[]; forwards: MailboxForward[]; reservations: MailboxReservation[]; names: Map<string, string> }

export function buildMailboxReport(x: MailboxReportData, from: string, to: string, today: string) {
  const dayBefore = new Date(Date.parse(from + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
  const end = to < today ? to : today;
  const boxes = {
    at_start: x.boxes.filter((b) => inUse(b, dayBefore)).length,
    at_end: x.boxes.filter((b) => inUse(b, end)).length,
    new: x.boxes.filter((b) => inRange(b.start_date, from, to)).length,
    closed: x.boxes.filter((b) => b.status === 'closed' && inRange(b.closed_at, from, to)).length,
    // Still not renewed: their paid-through date fell in the period and is still where it was.
    expired: x.boxes.filter((b) => inRange(b.paid_through, from, to) && b.paid_through < today && b.status === 'active').length,
    by_size: SIZES.map((s) => ({ size: s.id, name: s.name, rented: x.boxes.filter((b) => b.size === s.id && inUse(b, end)).length, total: s.to - s.from + 1 })),
  };
  const paid = x.charges.filter((c) => c.status === 'paid' && inRange(c.paid_at, from, to));
  const online = x.renewals.filter((r) => r.status === 'paid' && inRange(r.paid_at, from, to));
  const money = {
    online_renewals: { n: online.length, amount: sum(online) },
    auto_renewals: { n: paid.filter((c) => c.kind === 'renewal').length, amount: sum(paid.filter((c) => c.kind === 'renewal')) },
    letter_overage: { n: paid.filter((c) => c.kind === 'overage').length, amount: sum(paid.filter((c) => c.kind === 'overage')) },
    package_fees: { n: paid.filter((c) => c.kind === 'package').length, amount: sum(paid.filter((c) => c.kind === 'package')) },
    storage_fees: { n: paid.filter((c) => c.kind === 'storage').length, amount: sum(paid.filter((c) => c.kind === 'storage')) },
    fees_paid_at_counter: sum(x.charges.filter((c) => c.status === 'paid_counter' && inRange(c.paid_at, from, to))),
    waived: sum(x.charges.filter((c) => c.status === 'waived' && inRange(c.paid_at, from, to))),
    declined: sum(x.charges.filter((c) => c.status === 'failed' && inRange(c.created_at, from, to))),
    owed_now: sum(x.charges.filter((c) => c.status === 'unbilled' || c.status === 'failed')),
    total: 0,
  };
  money.total = round(money.online_renewals.amount + money.auto_renewals.amount + money.letter_overage.amount + money.package_fees.amount + money.storage_fees.amount + money.fees_paid_at_counter);
  const came = x.items.filter((i) => inRange(i.arrived_at, from, to));
  const out = x.items.filter((i) => i.status !== 'in' && inRange(i.out_at, from, to));
  const waits = out.filter((i) => i.kind === 'package' && i.status === 'picked_up').map((i) => daysBetween(d10(i.arrived_at), d10(i.out_at)));
  const mail = {
    letters_in: came.filter((i) => i.kind === 'letter').length,
    packages_in: came.filter((i) => i.kind === 'package').length,
    picked_up: out.filter((i) => i.status === 'picked_up').length,
    forwarded: out.filter((i) => i.status === 'forwarded').length,
    returned: out.filter((i) => i.status === 'returned').length,
    avg_package_wait_days: waits.length ? Math.round((waits.reduce((a, n) => a + n, 0) / waits.length) * 10) / 10 : null,
  };
  const people = {
    reservations: x.reservations.filter((r) => inRange(r.created_at, from, to)).length,
    forward_requests: x.forwards.filter((f) => inRange(f.created_at, from, to)).length,
    on_hold_now: x.boxes.filter((b) => mailAction(b, today).do === 'hold').length,
    return_to_sender_now: x.boxes.filter((b) => mailAction(b, today).do === 'rts').length,
  };
  // Every money line in the period, for the spreadsheet.
  const box = (id: number) => x.boxes.find((b) => b.id === id)?.box_no ?? '';
  const lines = [
    ...online.map((r) => ({ date: d10(r.paid_at), customer: x.names.get(r.customer_id) ?? '', box: box(r.mailbox_id), what: `Online renewal, ${r.term} months`, amount: r.amount, status: 'paid' })),
    ...x.charges.filter((c) => c.status !== 'unbilled' && inRange(c.status === 'failed' ? c.created_at : c.paid_at, from, to))
      .map((c) => ({ date: d10(c.status === 'failed' ? c.created_at : c.paid_at), customer: x.names.get(c.customer_id) ?? '', box: box(c.mailbox_id), what: c.description.replace(/ \((piece \d+|fee [^)]+)\)$/, ''), amount: c.amount, status: c.status })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return { from, to, boxes, money, mail, people, lines };
}

const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** The report as a spreadsheet (opens in Excel): the summary first, then every money line. */
export function mailboxReportCsv(r: ReturnType<typeof buildMailboxReport>): string {
  const rows: unknown[][] = [['Goin\' Postal mailbox report', `${r.from} to ${r.to}`], [], ['Section', 'What', 'Count', 'Amount']];
  rows.push(['Boxes', 'In use at the start', r.boxes.at_start], ['Boxes', 'In use at the end', r.boxes.at_end], ['Boxes', 'New', r.boxes.new], ['Boxes', 'Closed', r.boxes.closed], ['Boxes', 'Expired, not renewed', r.boxes.expired]);
  for (const s of r.boxes.by_size) rows.push(['Boxes', `${s.name} rented`, `${s.rented} of ${s.total}`]);
  const m = r.money;
  rows.push(['Money', 'Online renewals', m.online_renewals.n, m.online_renewals.amount.toFixed(2)], ['Money', 'Automatic renewals', m.auto_renewals.n, m.auto_renewals.amount.toFixed(2)],
    ['Money', 'Letter overage (45c)', m.letter_overage.n, m.letter_overage.amount.toFixed(2)], ['Money', 'Extra-package fees', m.package_fees.n, m.package_fees.amount.toFixed(2)],
    ['Money', 'Package storage', m.storage_fees.n, m.storage_fees.amount.toFixed(2)], ['Money', 'Fees paid at the counter', '', m.fees_paid_at_counter.toFixed(2)],
    ['Money', 'Total taken', '', m.total.toFixed(2)], ['Money', 'Waived', '', m.waived.toFixed(2)], ['Money', 'Declined', '', m.declined.toFixed(2)], ['Money', 'Owed now', '', m.owed_now.toFixed(2)]);
  rows.push(['Mail', 'Letters in', r.mail.letters_in], ['Mail', 'Packages in', r.mail.packages_in], ['Mail', 'Picked up', r.mail.picked_up], ['Mail', 'Forwarded', r.mail.forwarded], ['Mail', 'Returned to sender', r.mail.returned], ['Mail', 'Average days a package waited', r.mail.avg_package_wait_days ?? '']);
  rows.push(['People', 'Reservations', r.people.reservations], ['People', 'Forwarding requests', r.people.forward_requests], ['People', 'Expired boxes on mail hold now', r.people.on_hold_now], ['People', 'Boxes past their hold (return to sender) now', r.people.return_to_sender_now]);
  rows.push([], ['Date', 'Customer', 'Box', 'What', 'Amount', 'Status']);
  for (const l of r.lines) rows.push([l.date, l.customer, l.box, l.what, l.amount.toFixed(2), l.status]);
  return rows.map((row) => row.map(cell).join(',')).join('\n') + '\n';
}
