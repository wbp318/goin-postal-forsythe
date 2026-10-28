// The carrier invoice matcher.
import { describe, it, expect } from 'vitest';
import { audit, groupInvoice, guessColumns, sampleInvoiceCsv } from '../src/lib/invoices';

const ship = (id: string, t: string, cost: number, status = 'labeled') => [t, { id, tracking_number: t, cost, status, carrier: 'UPS', service: 'UPS Ground', created_at: '2026-10-01T00:00:00Z' } as any] as const;
const shipments = new Map<string, any>([ship('GP-A', '1Z1', 10), ship('GP-B', '1Z2', 12), ship('GP-C', '1Z3', 8), ship('GP-D', '1Z4', 9, 'voided'), ship('GP-E', '1Z5', 11)]);

describe('invoice audit', () => {
  it('folds surcharges into their tracking number and spots a repeated base charge', () => {
    const { grouped, duplicates } = groupInvoice([
      { tracking: '1z2', billed: 12, description: 'Base Charge' }, { tracking: '1Z2', billed: 18, description: 'Address Correction' },
      { tracking: '1Z5', billed: 11, description: 'Base Charge' }, { tracking: '1Z5', billed: 11, description: 'Base Charge' },
    ]);
    expect(grouped.get('1Z2')).toMatchObject({ billed: 30, description: 'Base Charge + Address Correction' });
    expect(duplicates.has('1Z5')).toBe(true);
    expect(duplicates.has('1Z2')).toBe(false);
  });
  it('classes every line and sums what to dispute', () => {
    const r = audit([
      { tracking: '1z1', billed: 10, description: 'Base Charge' },
      { tracking: '1Z2', billed: 12, description: 'Base Charge' }, { tracking: '1Z2', billed: 18, description: 'Address Correction' },
      { tracking: '1Z3', billed: 7.5, description: 'Base Charge' },
      { tracking: '1Z4', billed: 9, description: 'Base Charge' },
      { tracking: '1Z5', billed: 11, description: 'Base Charge' }, { tracking: '1Z5', billed: 11, description: 'Base Charge' },
      { tracking: '1Z9', billed: 5, description: 'Base Charge' },
    ], shipments);
    const by = Object.fromEntries(r.lines.map((l) => [l.tracking, l.status]));
    expect(by).toEqual({ '1Z1': 'match', '1Z2': 'over', '1Z3': 'under', '1Z4': 'voided', '1Z5': 'duplicate', '1Z9': 'unknown' });
    expect(r.lines[0].status).toBe('voided'); // worst first
    expect(r.summary).toMatchObject({ lines: 6, billed: 83.5, expected: 50, over: 1, under: 1, unknown: 1, voided: 1, duplicate: 1, match: 1 });
    expect(r.summary.overcharged_amount).toBe(18 + 11 + 9); // over + the duplicate's extra + the whole voided line
  });
  it('tolerance decides what counts as a difference', () => {
    const r = audit([{ tracking: '1Z1', billed: 10.3, description: 'Base' }], shipments, 0.5);
    expect(r.lines[0].status).toBe('match');
  });
  it('guesses columns by header words in order of preference, not by first match', () => {
    expect(guessColumns(['Pickup Date', 'Tracking Number', 'Charge Description', 'Net Charge'], [['2026-10-01', '1Z999AA10123456784', 'Base', '12.40']])).toEqual({ tracking: 1, billed: 3, description: 2, date: 0 });
  });
  it('falls back to the values when headers say nothing', () => {
    const g = guessColumns(['a', 'b', 'c'], [['x', '1Z999AA10123456784', '12.40'], ['y', '1Z999AA10123456785', '3.10']]);
    expect(g.tracking).toBe(1);
    expect(g.billed).toBe(2);
  });
  it('builds a sample invoice with surcharges, a duplicate and a stranger', () => {
    const csv = sampleInvoiceCsv([...shipments.values()].filter((s) => s.status !== 'voided'));
    expect(csv.split('\r\n')[0]).toBe('Tracking Number,Charge Description,Net Charge,Ship Date');
    expect(csv).toMatch(/Address Correction/);
    expect(csv).toMatch(/1Z999AA10123456784/);
  });
});
