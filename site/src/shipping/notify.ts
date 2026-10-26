// Customer updates: email and text when a shipment is scanned in, out for delivery, delivered, or in
// trouble. Email goes through Resend (free to 3,000 a month), text through Twilio (about a cent each).
// With no keys both are logged instead, so the flow can be tested with nothing configured.
// Each shipment gets at most one message per status, recorded in the notifications table.
import type { TrackingEvent } from './types';
import { getContacts, notificationSent, recordNotification, type ShipmentRow } from './store';
import { store } from '../data/store';

type Notifiable = 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'returned';
const NOTIFY: Notifiable[] = ['in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned'];

const SUBJECT: Record<Notifiable, string> = {
  in_transit: 'Your package is on its way',
  out_for_delivery: 'Your package is out for delivery today',
  delivered: 'Your package was delivered',
  exception: 'A problem with your package',
  returned: 'Your package is coming back to us',
};
const BODY: Record<Notifiable, string> = {
  in_transit: 'The carrier has scanned your package and it is moving.',
  out_for_delivery: 'It should arrive today.',
  delivered: 'The carrier reports it delivered. Thank you for shipping with us.',
  exception: 'The carrier reported a problem. We are watching it; call or stop by the shop if you have questions.',
  returned: 'The carrier is returning it to the shop. We will call you when it arrives.',
};

export interface Sent { channel: 'email' | 'sms'; to: string; status: Notifiable; mock: boolean }

/** Called after new tracking events are stored. Sends whatever the customer has not yet been told. */
export async function notifyEvents(env: Env, s: ShipmentRow, fresh: TrackingEvent[]): Promise<Sent[]> {
  const out: Sent[] = [];
  const statuses = NOTIFY.filter((st) => fresh.some((e) => e.status === st));
  if (!statuses.length) return out;
  const c = await getContacts(env, s.id);
  if (!c) return out;
  const trackUrl = `${env.SITE_URL}/track?q=${s.id}`;
  const d = JSON.parse(s.destination_json);
  const latest = [...fresh].sort((a, b) => b.at.localeCompare(a.at));
  for (const st of statuses) {
    if (await notificationSent(env, s.id, st)) continue;
    const ev = latest.find((e) => e.status === st)!;
    const where = ev.location ? ` (${ev.location})` : '';
    const line = `${label(s)} to ${d.contact_name}, ${d.city}: ${ev.description}${where}.`;
    if (c.email) {
      const mock = await sendEmail(env, c.email, SUBJECT[st], `${BODY[st]}\n\n${line}\n\nTrack it: ${trackUrl}\nPickup code ${s.id}\n\n${store.name}\n${store.address}`);
      out.push({ channel: 'email', to: c.email, status: st, mock });
    }
    if (c.phone && c.sms_opt_in) {
      const mock = await sendSms(env, c.phone, `${store.name}: ${SUBJECT[st].toLowerCase()}. ${ev.description}. ${trackUrl}`);
      out.push({ channel: 'sms', to: c.phone, status: st, mock });
    }
    await recordNotification(env, s.id, st, out.filter((x) => x.status === st).map((x) => x.channel).join(',') || 'none');
  }
  // Staff hear about problems too, if an address is set.
  if (env.STAFF_EMAIL && statuses.some((st) => st === 'exception' || st === 'returned')) {
    await sendEmail(env, env.STAFF_EMAIL, `Shipment ${s.id} needs attention`, `${label(s)} to ${d.contact_name}, ${d.city} ${d.state}.\n${latest[0].description}\n\n${env.SITE_URL}/counter/exceptions`);
  }
  return out;
}

/** Resend. Returns true when it only logged (mock). */
export async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) { console.log(`[mock email] to ${to}: ${subject}\n${text}`); return true; }
  const from = env.MAIL_FROM || `${store.name} <updates@${new URL(env.SITE_URL).hostname}>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html: `<pre style="font:16px/1.5 system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>` }),
  });
  if (!res.ok) throw new Error(`email: Resend ${res.status} ${await res.text()}`);
  return false;
}

/** Twilio. Returns true when it only logged (mock). */
export async function sendSms(env: Env, to: string, body: string): Promise<boolean> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) { console.log(`[mock sms] to ${to}: ${body}`); return true; }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: normalizePhone(to), From: env.TWILIO_FROM, Body: body.slice(0, 320) }),
  });
  if (!res.ok) throw new Error(`sms: Twilio ${res.status} ${await res.text()}`);
  return false;
}

/** US numbers typed any which way become +1XXXXXXXXXX; anything already starting with + is kept. */
export function normalizePhone(p: string): string {
  const t = p.trim();
  if (t.startsWith('+')) return '+' + t.slice(1).replace(/\D/g, '');
  const digits = t.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

/** "USPS Ground Advantage", not "USPS USPS Ground Advantage": service names usually carry the carrier already. */
const label = (s: ShipmentRow) => (s.service.toLowerCase().startsWith(s.carrier.toLowerCase()) ? s.service : `${s.carrier} ${s.service}`);

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
