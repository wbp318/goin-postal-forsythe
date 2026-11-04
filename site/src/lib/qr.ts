// "Scan their QR" (v1.80.0). Customers walk in with a QR code on their phone instead of a label.
// Some of those codes are a link to a PDF label the store can print today. The rest are
// "label-less" tokens that only the carrier's own retail software can redeem (The UPS Store, FedEx
// Office, a Post Office with Label Broker), and the store cannot. This file reads the text inside a
// QR and says which it is, so the counter page can print, or say where to go, and log the turn-away.
// The log is the evidence Peter takes to the UPS rep for the Access Point label-printing program.

export type QrKind = 'url' | 'ups' | 'fedex' | 'usps' | 'amazon' | 'other';
export interface QrRead {
  kind: QrKind;
  /** What to do at the counter, in one line. */
  advice: string;
  /** For a link: where it goes. */
  url?: string;
  /** The host of a link, for the log. */
  host?: string;
  /** A link that is plainly a PDF, which the browser prints as is. */
  pdf?: boolean;
  /** The carrier the token belongs to, when it is one. */
  carrier?: 'UPS' | 'FedEx' | 'USPS';
}

/** Where a label-less code can be redeemed, by carrier. Shown to the customer. */
export const WHERE_TO_GO: Record<'UPS' | 'FedEx' | 'USPS', string> = {
  UPS: 'a The UPS Store (the Access Point program is being asked for; until then UPS Store only)',
  FedEx: 'a FedEx Office, a FedEx Ship Center or a Walgreens',
  USPS: 'a Post Office with Label Broker at the counter or the kiosk',
};

/** What staff say so the next one does not walk out. One line per case. */
export const COUNTER_SCRIPT: Record<QrKind, string> = {
  url: 'That code is a link to your label. We can print it here for $2 and send it today.',
  ups: 'That UPS code only prints at The UPS Store. If it is an Amazon return, open the return in the Amazon app, choose the printed-label option instead, and email or show me the PDF: we print it and it goes out today.',
  fedex: 'That FedEx code prints at FedEx Office or a Walgreens. If the seller offers a printable label, email it to us and we print it here.',
  usps: 'That USPS code prints at the Post Office. If the seller offers a printable label, email it to us and we print it here.',
  amazon: 'An Amazon return. Open the return in the Amazon app, choose the printed-label option, and email or show me the PDF: we print it and it goes out today.',
  other: 'I cannot read that code as a label. Do you have the email with the label attached? We print it here for $2.',
};

const hostOf = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, '');

/** Read the text a QR holds and say what the counter can do with it. */
export function readQr(text: string): QrRead {
  const t = text.trim();
  let u: URL | null = null;
  try { u = /^https?:\/\//i.test(t) ? new URL(t) : null; } catch { u = null; }
  if (u) {
    const host = hostOf(u);
    const pdf = /\.pdf(\?|$)/i.test(u.pathname + u.search) || /[?&](format|type)=pdf\b/i.test(u.search);
    if (/(^|\.)ups\.com$/.test(host)) return { kind: 'ups', carrier: 'UPS', url: t, host, advice: COUNTER_SCRIPT.ups };
    if (/(^|\.)fedex\.com$/.test(host)) return { kind: 'fedex', carrier: 'FedEx', url: t, host, advice: COUNTER_SCRIPT.fedex };
    if (/(^|\.)usps\.com$/.test(host)) return { kind: 'usps', carrier: 'USPS', url: t, host, advice: COUNTER_SCRIPT.usps };
    if (/(^|\.)amazon\.com$|(^|\.)amzn\.to$|(^|\.)a\.co$/.test(host)) return { kind: 'amazon', url: t, host, advice: COUNTER_SCRIPT.amazon };
    return { kind: 'url', url: t, host, pdf, advice: COUNTER_SCRIPT.url };
  }
  // Not a link: a bare token. A few shapes are recognisable; the rest is "other" and staff pick the carrier.
  if (/^1Z[0-9A-Z]{16}$/i.test(t)) return { kind: 'ups', carrier: 'UPS', advice: COUNTER_SCRIPT.ups };
  if (/^9[0-9]{21}$|^(94|93|92)[0-9]{20,24}$/.test(t)) return { kind: 'usps', carrier: 'USPS', advice: COUNTER_SCRIPT.usps };
  if (/^[0-9]{12}$|^[0-9]{15}$|^[0-9]{20}$/.test(t)) return { kind: 'fedex', carrier: 'FedEx', advice: COUNTER_SCRIPT.fedex };
  return { kind: 'other', advice: COUNTER_SCRIPT.other };
}
