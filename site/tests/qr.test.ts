// "Scan their QR" (v1.80.0): what the counter makes of the text inside a customer's QR, and the log.
import { describe, it, expect } from 'vitest';
import { readQr, COUNTER_SCRIPT } from '../src/lib/qr';
import * as store from '../src/shipping/store';

const env = {} as any;

describe('readQr', () => {
  it('a link to a PDF label is printable here', () => {
    const r = readQr('https://returns.example-shop.com/labels/abc123.pdf');
    expect(r).toMatchObject({ kind: 'url', host: 'returns.example-shop.com', pdf: true, advice: COUNTER_SCRIPT.url });
  });
  it('carrier links and tokens are label-less codes with a place to go', () => {
    expect(readQr('https://www.ups.com/mobile/label?token=XYZ')).toMatchObject({ kind: 'ups', carrier: 'UPS' });
    expect(readQr('https://www.fedex.com/returns/qr/123')).toMatchObject({ kind: 'fedex', carrier: 'FedEx' });
    expect(readQr('https://tools.usps.com/label-broker?id=ABC')).toMatchObject({ kind: 'usps', carrier: 'USPS' });
    expect(readQr('1Z999AA10123456784')).toMatchObject({ kind: 'ups', carrier: 'UPS' });
    expect(readQr('9400111899223033005410')).toMatchObject({ kind: 'usps' });
    expect(readQr('https://www.amazon.com/returns/qr/abc')).toMatchObject({ kind: 'amazon' });
    expect(readQr('hello there').kind).toBe('other');
  });
});

describe('qr_scans', () => {
  it('logs each scan and counts the turn-aways by carrier', async () => {
    await store.logQrScan(env, { by_name: 'Pat', kind: 'ups', carrier: 'UPS', host: 'ups.com', outcome: 'turned_away', note: null });
    await store.logQrScan(env, { by_name: 'Pat', kind: 'ups', carrier: 'UPS', host: null, outcome: 'turned_away', note: 'Amazon return' });
    await store.logQrScan(env, { by_name: 'Pat', kind: 'url', carrier: null, host: 'shop.example', outcome: 'printed', note: null });
    const s = await store.qrScanStats(env, 30);
    expect(s.turned_away).toEqual({ UPS: 2 });
    expect(s.printed).toBe(1);
    expect(s.total).toBe(3);
    expect(store.EXPORT_TABLES).toContain('qr_scans');
  });
});
