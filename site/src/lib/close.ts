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
  line(`Drop-offs accepted ${c.dropoffs.accepted}, handed to carriers ${c.dropoffs.handed}, still here ${c.dropoffs.waiting}`);
  line(`Quotes still open ${c.open_quotes}    Exceptions open ${c.exceptions}`);
  line(`Walk-ups ${c.walkups}    Returns ${c.returns}    Cancelled quotes ${c.cancelled}`); rule();
  for (const r of c.refunds_owed.slice(0, 6)) line(`Refund ${r.id} ${money(r.amount)} via ${r.paid_via}`);
  if (note) { rule(); line(`Note: ${note}`); }
  L.push(`^FO40,${Math.max(y + 10, 1150)}^A0N,22,22^FDPeterShip Z-report^FS`, '^XZ');
  return L.join('\n');
}
