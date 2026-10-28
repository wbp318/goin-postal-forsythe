// Drop-off receipts. A customer hands over a prepaid or return package; this is the slip that proves
// we took it, with the time and the barcode. Two forms: ZPL for the 4 by 6 thermal printer at the
// counter (through the print queue and the printer agent), and plain text for a text message.
import type { Dropoff } from './store';
import { store } from '../data/store';

// ZPL treats ^ and ~ as commands, so they are stripped from anything a person typed.
const safe = (s: string | null | undefined, max = 40) => (s ?? '').replace(/[\^~\\]/g, ' ').slice(0, max);

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** A 4 by 6 inch receipt at 203 dpi (812 by 1218 dots), the size of a shipping label, so the same Zebra prints it. */
export function dropoffReceiptZpl(d: Dropoff): string {
  const lines = [
    '^XA', '^CI28', '^PW812', '^LL1218', '^LH0,0',
    `^FO40,40^A0N,48,48^FD${safe(store.name)}^FS`,
    `^FO40,96^A0N,26,26^FD${safe(store.address, 60)}^FS`,
    `^FO40,128^A0N,26,26^FD${safe(store.phone)}^FS`,
    '^FO40,170^GB732,3,3^FS',
    '^FO40,195^A0N,60,60^FDDROP-OFF RECEIPT^FS',
    `^FO40,270^A0N,30,30^FDReceived ${when(d.accepted_at)}^FS`,
    `^FO40,310^A0N,30,30^FDCarrier: ${safe(d.carrier) || 'to be confirmed'}^FS`,
    `^FO40,350^A0N,30,30^FDReceipt no. ${d.id}^FS`,
    d.customer_name ? `^FO40,390^A0N,30,30^FDFrom: ${safe(d.customer_name)}^FS` : '',
    d.accepted_by ? `^FO40,430^A0N,30,30^FDAccepted by: ${safe(d.accepted_by, 20)}^FS` : '',
    '^FO40,480^A0N,26,26^FDTracking number^FS',
    `^FO40,510^BY3,3,140^BCN,140,Y,N,N^FD${safe(d.barcode)}^FS`,
    '^FO40,720^GB732,3,3^FS',
    '^FO40,745^A0N,26,26^FB732,4,4,L^FDWe handed this package to the carrier named above on their next pickup. Track it on the carrier\'s website with the number above. Keep this receipt until it is delivered.^FS',
    `^FO40,880^A0N,26,26^FB732,3,4,L^FDQuestions: ${safe(store.phone)}. Bring this receipt or the number.^FS`,
    '^FO40,1120^A0N,22,22^FDThank you for shipping with us.^FS',
    '^XZ',
  ];
  return lines.filter(Boolean).join('\n');
}

/** ESC/POS bytes for a till-roll receipt printer (58 or 80 mm), when RECEIPT_FORMAT=escpos is set. Returned as a binary string for btoa(). */
export function dropoffReceiptEscpos(d: Dropoff): string {
  return escpos([
    { t: store.name, bold: true, center: true }, { t: store.address, center: true }, { t: store.phone, center: true }, { t: '' },
    { t: 'DROP-OFF RECEIPT', bold: true, center: true, wide: true }, { t: '' },
    { t: `Received ${when(d.accepted_at)}` }, { t: `Carrier: ${d.carrier ?? 'to be confirmed'}` }, { t: `Receipt no. ${d.id}` },
    ...(d.customer_name ? [{ t: `From: ${d.customer_name}` }] : []), ...(d.accepted_by ? [{ t: `Accepted by: ${d.accepted_by}` }] : []),
    { t: '' }, { t: 'Tracking number', center: true }, { barcode: d.barcode }, { t: d.barcode, center: true }, { t: '' },
    { t: "We handed this package to the carrier named above on their next pickup. Track it on the carrier's website with the number above. Keep this receipt until it is delivered." },
    { t: '' }, { t: `Questions: ${store.phone}. Bring this receipt or the number.` }, { t: '' }, { t: 'Thank you for shipping with us.', center: true },
  ]);
}

/** A small ESC/POS builder: init, alignment, bold, double width, Code 128 barcode, feed and cut. Latin-1 text only. */
export function escpos(lines: ({ t: string; bold?: boolean; center?: boolean; wide?: boolean } | { barcode: string })[]): string {
  const ESC = '\x1b', GS = '\x1d';
  let out = `${ESC}@`;
  for (const l of lines) {
    if ('barcode' in l) { const code = l.barcode.replace(/[^\x20-\x7e]/g, '').slice(0, 40); out += `${ESC}a\x01${GS}h\x50${GS}w\x02${GS}H\x00${GS}k\x49${String.fromCharCode(code.length + 2)}{B${code}\n${ESC}a\x00`; continue; }
    const text = l.t.normalize('NFKD').replace(/[^\x20-\x7e\n]/g, '');
    out += `${ESC}a${l.center ? '\x01' : '\x00'}${ESC}E${l.bold ? '\x01' : '\x00'}${GS}!${l.wide ? '\x11' : '\x00'}${wrap(text, l.wide ? 16 : 32)}\n${GS}!\x00${ESC}E\x00${ESC}a\x00`;
  }
  return out + `\n\n\n${GS}V\x41\x03`;
}
const wrap = (s: string, w: number) => s.split('\n').flatMap((line) => { const words = line.split(' '); const rows: string[] = []; let cur = ''; for (const wd of words) { if ((cur + ' ' + wd).trim().length > w) { rows.push(cur.trim()); cur = wd; } else cur = (cur + ' ' + wd); } rows.push(cur.trim()); return rows; }).join('\n');

/** The same receipt in one text message. */
export function dropoffReceiptText(d: Dropoff): string {
  return `${store.name}: we received your ${d.carrier ?? ''} package ${d.barcode} on ${when(d.accepted_at)} (receipt ${d.id}). It goes out on the carrier's next pickup; track it on their site with that number. Questions: ${store.phone}.`.replace(/\s+/g, ' ');
}
