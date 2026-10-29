// Mailbox mail notifications (to-do T12): the promise on /mailbox, "a text or email when mail or a
// package arrives." Staff tap Mail in or Package in on the counter page; the holder gets a text when
// there is a phone and an email always, and a notice row is kept so the page shows the history.
import { store } from '../data/store';
import { sendSms, sendEmail, normalizePhone } from '../shipping/notify';
import { addMailboxNotice, type Mailbox, type MailboxNotice } from '../shipping/store';

export type NoticeKind = 'mail' | 'package' | 'other';
export const KINDS: NoticeKind[] = ['mail', 'package', 'other'];

/** The text of the message. Short, English, with the box number and the hours, because it leaves the building. */
export function noticeText(m: Mailbox, kind: NoticeKind, note: string): string {
  const what = kind === 'mail' ? 'Mail' : kind === 'package' ? 'A package' : 'Something';
  const who = m.business_name || m.customer_name;
  const open = store.hours.filter((h) => h.open !== 'Closed').map((h) => `${h.days} ${h.open}`).join(', ');
  return `${store.name}: ${what} arrived for ${who}${m.box_number ? ` in box #${m.box_number}` : ''}${note ? ` (${note})` : ''}. Pick it up at ${store.address}. ${open}.`.replace(/\s+/g, ' ');
}

/** Send the notice and record it. Mock senders only log, which the result says. */
export async function notifyMailbox(env: Env, m: Mailbox, kind: NoticeKind, note: string, by: string): Promise<MailboxNotice & { text_mock?: boolean; email_mock?: boolean }> {
  const text = noticeText(m, kind, note);
  let texted = 0, emailed = 0, text_mock: boolean | undefined, email_mock: boolean | undefined;
  const errors: string[] = [];
  if (m.phone && normalizePhone(m.phone).length >= 11) {
    try { text_mock = await sendSms(env, normalizePhone(m.phone), text); texted = 1; } catch (e: any) { errors.push(e.message); }
  }
  if (m.email) {
    try { email_mock = await sendEmail(env, m.email, `${what(kind)} arrived at ${store.name}`, text); emailed = 1; } catch (e: any) { errors.push(e.message); }
  }
  const row = await addMailboxNotice(env, { mailbox_code: m.code, kind, note: note || null, by_name: by, texted, emailed, error: errors.join('; ') || null });
  return { ...row, text_mock, email_mock };
}
const what = (k: NoticeKind) => (k === 'mail' ? 'Mail' : k === 'package' ? 'A package' : 'Something');
