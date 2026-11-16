// "Return label included" (Peter, Nov 14 2026): the return label is bought as a PDF so the customer and the
// counter can open, print and email it; voiding the order voids it too.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const bought: { rateId: string; opts: { qr: boolean; zpl: boolean } }[] = [];
const voided: string[] = [];
const refuse = new Set<string>();
vi.mock('../src/shipping/engine', () => ({
  buyLabel: vi.fn(async (_env: any, _o: any, _d: any, _p: any, rateId: string, opts: { qr: boolean; zpl: boolean }) => {
    bought.push({ rateId, opts });
    const n = bought.length;
    // Like the direct adapters: ZPL fills only label_zpl, PDF only label_url.
    return { id: `usps:TRK${n}${Math.random().toString(36).slice(2, 6)}`, carrier: 'USPS', service: 'USPS Ground Advantage', label_url: opts.zpl ? null : 'data:application/pdf;base64,JVBERi0=', label_zpl: opts.zpl ? 'Xlha' : null, qr_url: null, tracking_number: `TRK${n}`, tracking_page_url: null, cost: 5 };
  }),
  voidLabel: vi.fn(async (_env: any, id: string) => { if (refuse.has(id)) throw new Error('already scanned'); voided.push(id); }),
}));

import { fulfil, voidReturnLabel, returnLabelForEmail, RETURN_LABEL_FORMAT } from '../src/lib/fulfil';
import { getShipment, listAudit } from '../src/shipping/store';

const env = {} as any;
const staff = { id: null, name: 'Sam' };
const addr = { contact_name: 'A B', line_1: '1 Main St', city: 'Monroe', state: 'LA', postal_code: '71201', country_alpha2: 'US' };
const rate = { id: 'usps:USPS_GROUND_ADVANTAGE', carrier: 'USPS' as const, service: 'USPS Ground Advantage', cost: 5, total_charge: 9.65, currency: 'USD', min_days: 2, max_days: 5, billable_weight_lb: 3 };
const order = (extra: any = {}): any => ({
  id: 'GP-R' + Math.random().toString(36).slice(2, 7).toUpperCase(), status: 'awaiting_payment', created_at: new Date().toISOString(), email: 'a@example.com',
  origin: addr, destination: { ...addr, city: 'Dallas', state: 'TX', postal_code: '75201' },
  parcel: { weight_lb: 3, length_in: 12, width_in: 10, height_in: 6, description: '', value_usd: 1, options: { return_label: 'included' } },
  rate, international: false, total: 19.3, return_rate: rate, ...extra,
});

beforeEach(() => { bought.length = 0; voided.length = 0; refuse.clear(); });

describe('the included return label is a PDF', () => {
  it('buys the outgoing label as ZPL and the return label as a PDF with a label_url', async () => {
    const done = await fulfil(env, order(), 'mock');
    expect(bought.map((b) => b.opts.zpl)).toEqual([true, false]);
    expect(RETURN_LABEL_FORMAT.zpl).toBe(false);
    expect(done.return_label?.label_url).toMatch(/^data:application\/pdf;base64,/);
    expect((await getShipment(env, `${done.id}-R`))?.status).toBe('labeled');
  });
  it('goes in the counter email as an attachment, or as its link when hosted', () => {
    const o = order({ return_label: { label_url: 'data:application/pdf;base64,JVBERi0=' } });
    expect(returnLabelForEmail(o, 'https://example.test')).toEqual({ line: expect.stringContaining('attached'), attachment: { filename: `${o.id}-return-label.pdf`, content: 'JVBERi0=' } });
    expect(returnLabelForEmail(order({ return_label: { label_url: '/demo-label.html' } }), 'https://example.test').line).toContain('https://example.test/demo-label.html');
    expect(returnLabelForEmail(order(), 'https://example.test')).toEqual({ line: null });
  });
});

describe('voiding voids the return label too', () => {
  it('voids it with the carrier, marks shipment -R voided and writes the audit log', async () => {
    const done = await fulfil(env, order(), 'mock');
    expect(await voidReturnLabel(env, done, staff, 'Customer cancelled')).toBeUndefined();
    expect(voided).toEqual([done.return_label!.id]);
    expect((await getShipment(env, `${done.id}-R`))?.status).toBe('voided');
    expect((await listAudit(env)).find((a) => a.target === `${done.id}-R`)).toMatchObject({ action: 'label.void', staff_name: 'Sam' });
  });
  it('a return label the carrier refuses to void leaves a warning and an audit line, not an error', async () => {
    const done = await fulfil(env, order(), 'mock');
    refuse.add(done.return_label!.id);
    expect(await voidReturnLabel(env, done, staff, 'Wrong ZIP')).toMatch(/by hand/);
    expect((await getShipment(env, `${done.id}-R`))?.status).toBe('labeled');
    expect((await listAudit(env)).find((a) => a.target === `${done.id}-R`)).toMatchObject({ action: 'label.void.failed' });
  });
  it('does nothing for an order without a return label', async () => {
    const done = await fulfil(env, order({ return_rate: undefined }), 'mock');
    expect(await voidReturnLabel(env, done, staff, 'x')).toBeUndefined();
    expect(voided).toEqual([]);
  });
});
