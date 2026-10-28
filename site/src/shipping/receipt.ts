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

/** The same receipt in one text message. */
export function dropoffReceiptText(d: Dropoff): string {
  return `${store.name}: we received your ${d.carrier ?? ''} package ${d.barcode} on ${when(d.accepted_at)} (receipt ${d.id}). It goes out on the carrier's next pickup; track it on their site with that number. Questions: ${store.phone}.`.replace(/\s+/g, ' ');
}
