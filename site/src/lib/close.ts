// End-of-day close. One screen per day that says what PeterShip sold, what was voided, what the
// POS drawer should show for the part of the day that went through the counter, which refunds are
// still owed, and what is left open. Saving it freezes the numbers with a name and a note, and the
// Z-report can go to the counter printer or be printed from the browser.
import { dayFigures, type DayFigures } from '../shipping/store';
import { store } from '../data/store';
import { escpos } from '../shipping/receipt';

export interface CloseReport extends DayFigures {
  day: string;
  pos_expected: number;        // what the POS should show from PeterShip: counter-paid labels and extras, less counter refunds owed today
  stripe_expected: number;     // what Stripe collected today for labels and extras
  refunds_owed: { id: string; paid_via: string; amount: number; voided_at: string }[];
  drawer?: Drawer;             // the cash count (T18), typed at close time
}

/** The cash drawer at close (T18). What staff type, and what falls out of it. The POS is the source of
 *  the cash and card totals for the whole day; PeterShip only knows its own part, so the count is
 *  checked against the POS cash figure, not against PeterShip's. */
export interface DrawerInput { opening: number; counted: number; pos_cash: number; pos_card: number; paid_out: number; tips_cash: number; tips_card: number }
export interface Drawer extends DrawerInput { expected: number; over_short: number; tips: number; deposit: number }
export function drawerFigures(d: Partial<DrawerInput> | null | undefined): Drawer | undefined {
  if (!d) return undefined;
  const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? r2(x) : 0; };
  const i: DrawerInput = { opening: n(d.opening), counted: n(d.counted), pos_cash: n(d.pos_cash), pos_card: n(d.pos_card), paid_out: n(d.paid_out), tips_cash: n(d.tips_cash), tips_card: n(d.tips_card) };
  if (!i.counted && !i.pos_cash && !i.pos_card && !i.opening) return undefined; // nothing typed
  // Cash tips are in the drawer when they were counted with it; card tips are paid out of it or on payroll, the owners' call, so they are listed and not subtracted.
  const expected = r2(i.opening + i.pos_cash - i.paid_out + i.tips_cash);
  return { ...i, expected, over_short: r2(i.counted - expected), tips: r2(i.tips_cash + i.tips_card), deposit: r2(Math.max(0, i.counted - i.opening)) };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The day's figures with the two expected totals worked out. `day` is a YYYY-MM-DD in the shop's local calendar. */
export async function buildClose(env: Env, day: string, tzOffsetMinutes: number): Promise<CloseReport> {
  // The shop's day runs from local midnight to local midnight; the records are in UTC.
  const start = new Date(`${day}T00:00:00.000Z`).getTime() + tzOffsetMinutes * 60_000;
  const end = start + 86_400_000 - 1;
  const f = await dayFigures(env, new Date(start).toISOString(), new Date(end).toISOString());
  const refunds_owed = f.voided.map((v) => ({ id: v.id, paid_via: v.paid_via ?? 'unknown', amount: v.total, voided_at: v.voided_at }));
  const posRefunds = refunds_owed.filter((x) => x.paid_via === 'pos').reduce((a, x) => a + x.amount, 0);
  return {
    day, ...f,
    pos_expected: r2(f.paid.pos - posRefunds),
    stripe_expected: r2(f.paid.stripe),
    refunds_owed,
  };
}

const safe = (s: string | null | undefined, max = 40) => (s ?? '').replace(/[\^~\\]/g, ' ').slice(0, max);
const money = (n: number) => `$${n.toFixed(2)}`;

/** The Z-report for a till-roll receipt printer. */
export function closeEscpos(c: CloseReport, closedBy: string, note: string): string {
  const owed = c.refunds_owed.reduce((a, x) => a + x.amount, 0);
  return escpos([
    { t: store.name, bold: true, center: true }, { t: `END OF DAY ${c.day}`, bold: true, center: true, wide: true }, { t: `Closed by ${closedBy}`, center: true }, { t: '' },
    { t: `Labels sold ${c.labels.count}` }, { t: `Label sales ${money(c.labels.revenue)}` }, { t: `Add-ons and insurance ${money(c.addons.revenue)}` }, { t: `Carrier cost ${money(c.labels.cost)}` }, { t: `Margin on labels ${money(c.labels.revenue - c.labels.cost)}` }, { t: '' },
    { t: `Paid at the counter (POS) ${money(c.paid.pos)}`, bold: true }, { t: `Paid online (Stripe) ${money(c.paid.stripe)}` }, { t: `Billed to accounts ${money(c.paid.account ?? 0)}` }, { t: `Voided today ${c.voided.length}, refunds owed ${money(owed)}` },
    { t: `POS should show: ${money(c.pos_expected)}`, bold: true }, { t: '' }, // bold, not wide: wide wraps at 16 columns and would split the number
    ...(c.drawer ? [{ t: 'CASH DRAWER', bold: true }, { t: `Opening ${money(c.drawer.opening)}  POS cash ${money(c.drawer.pos_cash)}` }, { t: `Paid out ${money(c.drawer.paid_out)}  Tips cash ${money(c.drawer.tips_cash)}` }, { t: `Expected ${money(c.drawer.expected)}  Counted ${money(c.drawer.counted)}` }, { t: `${c.drawer.over_short >= 0 ? 'OVER' : 'SHORT'} ${money(Math.abs(c.drawer.over_short))}`, bold: true }, { t: `POS card ${money(c.drawer.pos_card)}  Tips card ${money(c.drawer.tips_card)}` }, { t: `Deposit ${money(c.drawer.deposit)}  Tips total ${money(c.drawer.tips)}` }, { t: '' }] : []),
    { t: `Drop-offs accepted ${c.dropoffs.accepted}, handed ${c.dropoffs.handed}, still here ${c.dropoffs.waiting}` }, { t: `Quotes open ${c.open_quotes}, exceptions ${c.exceptions}` }, { t: `Walk-ups ${c.walkups}, returns ${c.returns}, cancelled ${c.cancelled}` },
    ...c.refunds_owed.slice(0, 8).map((r) => ({ t: `Refund ${r.id} ${money(r.amount)} via ${r.paid_via}` })),
    ...(note ? [{ t: '' }, { t: `Note: ${note}` }] : []), { t: '' }, { t: 'PeterShip Z-report', center: true },
  ]);
}

/** The Z-report as a 4 by 6 ZPL label for the counter printer. */
export function closeZpl(c: CloseReport, closedBy: string, note: string): string {
  let y = 40;
  const L: string[] = ['^XA', '^CI28', '^PW812', '^LL1218', '^LH0,0'];
  const line = (text: string, size = 26, bold = false) => { L.push(`^FO40,${y}^A0N,${size},${size}^FD${safe(text, 60)}^FS`); y += size + 8; };
  const rule = () => { L.push(`^FO40,${y}^GB732,2,2^FS`); y += 12; };
  line(store.name, 40); line(`END OF DAY ${c.day}`, 34); line(`Closed by ${closedBy}`); rule();
  line(`Labels sold ${c.labels.count}    Label sales ${money(c.labels.revenue)}`);
  line(`Add-ons and insurance ${money(c.addons.revenue)}    Carrier cost ${money(c.labels.cost)}`);
  line(`Margin on labels ${money(c.labels.revenue - c.labels.cost)}`); rule();
  line(`Paid at the counter (POS) ${money(c.paid.pos)}`, 30, true);
  line(`Paid online (Stripe) ${money(c.paid.stripe)}`);
  line(`Billed to business accounts ${money(c.paid.account ?? 0)}`);
  line(`Voided today ${c.voided.length}, refunds owed ${money(c.refunds_owed.reduce((a, x) => a + x.amount, 0))}`);
  line(`POS should show from PeterShip: ${money(c.pos_expected)}`, 30, true); rule();
  if (c.drawer) {
    line(`Cash drawer: opening ${money(c.drawer.opening)}, POS cash ${money(c.drawer.pos_cash)}, paid out ${money(c.drawer.paid_out)}, cash tips ${money(c.drawer.tips_cash)}`);
    line(`Expected ${money(c.drawer.expected)}, counted ${money(c.drawer.counted)}: ${c.drawer.over_short >= 0 ? 'OVER' : 'SHORT'} ${money(Math.abs(c.drawer.over_short))}`, 30, true);
    line(`POS card ${money(c.drawer.pos_card)}, card tips ${money(c.drawer.tips_card)}, tips total ${money(c.drawer.tips)}, deposit ${money(c.drawer.deposit)}`); rule();
  }
  line(`Drop-offs accepted ${c.dropoffs.accepted}, handed to carriers ${c.dropoffs.handed}, still here ${c.dropoffs.waiting}`);
  line(`Quotes still open ${c.open_quotes}    Exceptions open ${c.exceptions}`);
  line(`Walk-ups ${c.walkups}    Returns ${c.returns}    Cancelled quotes ${c.cancelled}`); rule();
  for (const r of c.refunds_owed.slice(0, 6)) line(`Refund ${r.id} ${money(r.amount)} via ${r.paid_via}`);
  if (note) { rule(); line(`Note: ${note}`); }
  L.push(`^FO40,${Math.max(y + 10, 1150)}^A0N,22,22^FDPeterShip Z-report^FS`, '^XZ');
  return L.join('\n');
}
