// Printed slips and who may do what.
import { describe, it, expect } from 'vitest';
import { dropoffReceiptZpl, dropoffReceiptText, dropoffReceiptEscpos, escpos } from '../src/shipping/receipt';
import { closeZpl, closeEscpos, drawerFigures } from '../src/lib/close';
import { deliveredExtra } from '../src/shipping/notify';
import { hashPin, authenticate, validPin, CAN, atLeast } from '../src/lib/auth';
import { addStaff } from '../src/shipping/store';

const dropoff = { id: 7, barcode: '1Z999AA10123456784', carrier: 'UPS', customer_name: "Ann O'Neil ^test~", customer_phone: null, accepted_by: 'WP', accepted_at: '2026-10-28T14:00:00Z', handed_to_carrier_at: null, notes: null };

describe('receipts', () => {
  it('the ZPL slip carries a Code 128 barcode and strips control characters from typed text', () => {
    const z = dropoffReceiptZpl(dropoff);
    expect(z).toMatch(/\^BCN,140,Y,N,N\^FD1Z999AA10123456784\^FS/);
    expect(z).toMatch(/From: Ann O'Neil  test /);
    expect(z.startsWith('^XA')).toBe(true);
    expect(z.endsWith('^XZ')).toBe(true);
  });
  it('the text receipt is one line with the essentials', () => {
    const t = dropoffReceiptText(dropoff);
    expect(t).toMatch(/UPS package 1Z999AA10123456784/);
    expect(t).not.toMatch(/\n/);
  });
  it('the ESC/POS builder initialises, prints a barcode and cuts', () => {
    const b = escpos([{ t: 'Hello', bold: true, center: true }, { barcode: 'GP-TEST01' }]);
    expect(b.startsWith('\x1b@')).toBe(true);
    expect(b).toContain('\x1dk\x49');       // Code 128
    expect(b).toContain('{BGP-TEST01');      // code set B
    expect(b.endsWith('\x1dV\x41\x03')).toBe(true); // feed and cut
    expect(dropoffReceiptEscpos(dropoff)).toContain('DROP-OFF RECEIPT');
  });
  it('the Z-report shows the POS line in both formats', () => {
    const report: any = { day: '2026-10-28', labels: { count: 3, revenue: 30, cost: 20 }, addons: { lines: 1, revenue: 4 }, paid: { pos: 20, stripe: 14, account: 0 }, voided: [], dropoffs: { accepted: 2, handed: 1, waiting: 1 }, open_quotes: 1, exceptions: 0, walkups: 2, returns: 0, cancelled: 0, pos_expected: 20, stripe_expected: 14, refunds_owed: [] };
    expect(closeZpl(report, 'Rin', 'Drawer $2 over')).toMatch(/POS should show from PeterShip: \$20.00/);
    expect(closeEscpos(report, 'Rin', '')).toContain('POS should show: $20.00');
  });
});

describe('auth', () => {
  it('PIN rules and hashing', async () => {
    expect(validPin('1234')).toBe(true);
    expect(validPin('12345678')).toBe(true);
    expect(validPin('123')).toBe(false);
    expect(validPin('12a4')).toBe(false);
    expect(await hashPin('2468')).toBe(await hashPin('2468'));
    expect(await hashPin('2468')).not.toBe(await hashPin('2469'));
  });
  it('shared PINs sign in under their own names; the counter PIN is an owner only when no owner PIN exists', async () => {
    expect(await authenticate({ COUNTER_PIN: '1234' } as any, '1234')).toMatchObject({ name: 'Counter (shared PIN)', role: 'owner', shared: true });
    expect(await authenticate({ COUNTER_PIN: '1234', OWNER_PIN: '9999' } as any, '1234')).toMatchObject({ role: 'manager' });
    expect(await authenticate({ COUNTER_PIN: '1234', OWNER_PIN: '9999' } as any, '9999')).toMatchObject({ name: 'Owner (shared PIN)', role: 'owner' });
    expect(await authenticate({ COUNTER_PIN: '1234' } as any, '0000')).toBeNull();
    expect(await authenticate({} as any, '')).toBeNull();
  });
  it('a personal PIN beats the shared ones and carries its role', async () => {
    const env = { COUNTER_PIN: '1234' } as any;
    await addStaff(env, { name: 'Peter', pin_hash: await hashPin('13579'), role: 'manager' });
    const u = await authenticate(env, '13579');
    expect(u).toMatchObject({ name: 'Peter', role: 'manager', shared: false });
    expect(CAN.audit(u!)).toBe(true);
    expect(CAN.prices(u!)).toBe(false);
    expect(atLeast(u!, 'counter')).toBe(true);
  });
});

describe('cash drawer (T18)', () => {
  it('works out expected, over or short, tips and the deposit, and is absent when nothing was typed', () => {
    const d = drawerFigures({ opening: 200, counted: 612.5, pos_cash: 400, pos_card: 950, paid_out: 12.5, tips_cash: 20, tips_card: 35 })!;
    expect(d.expected).toBe(607.5);
    expect(d.over_short).toBe(5);
    expect(d.tips).toBe(55);
    expect(d.deposit).toBe(412.5);
    expect(drawerFigures({ opening: 200, counted: 190, pos_cash: 0, pos_card: 0, paid_out: 0, tips_cash: 0, tips_card: 0 })?.over_short).toBe(-10);
    expect(drawerFigures({})).toBeUndefined();
    expect(drawerFigures(null)).toBeUndefined();
    expect(drawerFigures({ opening: 'x' as any, counted: 100 })?.expected).toBe(0);
  });
  it('prints the drawer on both Z-reports', () => {
    const report: any = { day: '2026-10-29', labels: { count: 1, revenue: 20, cost: 10 }, addons: { revenue: 0 }, paid: { pos: 20, stripe: 0, account: 0 }, voided: [], pos_expected: 20, stripe_expected: 0, refunds_owed: [], dropoffs: { accepted: 0, handed: 0, waiting: 0 }, open_quotes: 0, exceptions: 0, walkups: 0, returns: 0, cancelled: 0, drawer: drawerFigures({ opening: 200, counted: 195, pos_cash: 0, pos_card: 0, paid_out: 0, tips_cash: 0, tips_card: 0 }) };
    expect(closeZpl(report, 'Rin', '')).toMatch(/SHORT \$5.00/);
    expect(closeEscpos(report, 'Rin', '')).toContain('SHORT $5.00');
  });
});

describe('delivered email extra (T21)', () => {
  it('asks for a review only when the store has its link, and always nudges back to the shop', () => {
    expect(deliveredExtra({ name: 'X', reviewUrl: '' })).not.toMatch(/review/);
    expect(deliveredExtra({ name: 'X', reviewUrl: 'https://g.page/r/abc/review' })).toMatch(/Google review[^\n]*https:\/\/g\.page\/r\/abc\/review/);
    expect(deliveredExtra({ name: 'X' })).toMatch(/ship online/);
  });
});
