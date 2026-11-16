export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { readSession } from '../../lib/session';
import { store } from '../../data/store';
import { sendEmail, sendSms } from '../../shipping/notify';
import {
  getCustomer, searchCustomers, logAudit, reserveMailbox, waitingReservation, listWaitingReservations, getReservation, setReservationStatus,
  assignMailbox, getMailbox, listActiveMailboxes, updateMailbox, type MailboxRow,
} from '../../shipping/store';
import { SIZES, sizeById, sizeForBox, isTerm, priceFor, addMonths, day, isDay, boxStatus, dueReminder, reminderText, addressFor } from '../../lib/mailbox';

// Physical mailboxes on the website (Peter, Nov 15 2026).
// Customer (signed in): reserve {size, term}, cancel_reservation.
// Staff (PIN): list, find {q}, assign {customer_id, box_no, term, start_date?, reservation_code?}, renew {id, term},
//   close {id}, remind {id} (one now), send_due (every reminder due today, each once). Every change is audited.
// The counter's register stays the full record (IDs, the 1583, payments); this is what the website shows and sends.

async function sendReminder(b: MailboxRow, key: string): Promise<{ sms: boolean; email: boolean; to: string }> {
  const c = await getCustomer(env, b.customer_id);
  const msg = reminderText(b, key, store);
  // sendSms/sendEmail return true only in mock mode, so "sent" here means "we had a number/address and it went".
  const sms = c?.phone ? (await sendSms(env, c.phone, msg.sms), true) : false;
  const email = c?.email ? (await sendEmail(env, c.email, msg.subject, msg.email + `\n\nYour mailbox address: ${addressFor(b.box_no)}`), true) : false;
  return { sms, email, to: c?.name ?? '' };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json().catch(() => ({}));

    // ---- customer
    if (b.action === 'reserve' || b.action === 'cancel_reservation') {
      const meId = await readSession(env, request.headers.get('cookie')).catch(() => null);
      const me = meId ? await getCustomer(env, meId) : null;
      if (!me) return json({ error: 'Sign in to reserve a mailbox.', signin: true }, 401);
      if (b.action === 'cancel_reservation') {
        const r = await waitingReservation(env, me.id);
        if (r) await setReservationStatus(env, r.id, 'cancelled');
        return json({ ok: true });
      }
      const size = sizeById(String(b.size ?? ''));
      const term = Number(b.term);
      if (!size) return json({ error: 'Pick a mailbox size.' }, 400);
      if (!isTerm(term)) return json({ error: 'Pick 6 months or a year.' }, 400);
      const r = await reserveMailbox(env, { customer_id: me.id, size: size.id, term });
      return json({ ok: true, reservation: { code: r.code, size: size.id, term, price: priceFor(size.id, term) } });
    }

    // ---- staff
    const user = await authenticate(env, b.pin);
    if (!user) return json({ error: 'Wrong PIN' }, 401);
    const who = { id: user.id, name: user.name };
    const today = day(new Date());

    if (b.action === 'list') {
      const [res, boxes] = await Promise.all([listWaitingReservations(env), listActiveMailboxes(env)]);
      const people = new Map<string, any>();
      for (const id of new Set([...res.map((r) => r.customer_id), ...boxes.map((x) => x.customer_id)])) people.set(id, await getCustomer(env, id));
      const person = (id: string) => { const c = people.get(id); return c ? { name: c.name, email: c.email, phone: c.phone } : { name: '?', email: null, phone: null }; };
      const used = new Set(boxes.map((x) => x.box_no));
      return json({
        today,
        sizes: SIZES.map((s) => ({ ...s, free: Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i).filter((n) => !used.has(n)).length })),
        reservations: res.map((r) => ({ ...r, customer: person(r.customer_id), price: priceFor(r.size as any, r.term as any) })),
        boxes: boxes.map((x) => ({ ...x, customer: person(x.customer_id), state: boxStatus(x, today), due: dueReminder({ ...x, reminders: JSON.parse(x.reminders) }, today) })),
      });
    }
    if (b.action === 'find') {
      const { customers } = await searchCustomers(env, String(b.q ?? '').slice(0, 60), 10);
      return json({ customers: customers.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone })) });
    }
    if (b.action === 'assign') {
      const boxNo = Number(b.box_no);
      const size = sizeForBox(boxNo);
      if (!size) return json({ error: `Box #${b.box_no} is not in any size's range (${SIZES.map((s) => `${s.name} ${s.from}-${s.to}`).join(', ')}).` }, 400);
      const term = Number(b.term);
      if (!isTerm(term)) return json({ error: 'Term must be 6 or 12 months.' }, 400);
      const customer = await getCustomer(env, String(b.customer_id ?? ''));
      if (!customer) return json({ error: 'Pick the customer’s account first.' }, 400);
      const start = isDay(b.start_date) ? b.start_date : today;
      const paid_through = isDay(b.paid_through) ? b.paid_through : addMonths(start, term);
      const box = await assignMailbox(env, { box_no: boxNo, customer_id: customer.id, size: size.id, term, start_date: start, paid_through });
      if (b.reservation_code) { const r = await getReservation(env, String(b.reservation_code)); if (r && r.customer_id === customer.id) await setReservationStatus(env, r.id, 'done'); }
      await logAudit(env, who, 'mailbox.assign', `#${boxNo}`, `${customer.name} · ${size.name} · ${term} months · paid through ${paid_through}`);
      return json({ ok: true, box });
    }
    const box = b.id != null ? await getMailbox(env, Number(b.id)) : null;
    if (b.action === 'renew') {
      if (!box || box.status !== 'active') return json({ error: 'No such open box' }, 404);
      const term = Number(b.term);
      if (!isTerm(term)) return json({ error: 'Term must be 6 or 12 months.' }, 400);
      // Renewing on time adds to the paid-through date; renewing after it lapsed starts again from today.
      const from = box.paid_through >= today ? box.paid_through : today;
      const paid_through = addMonths(from, term);
      await updateMailbox(env, box.id, { term, paid_through });
      await logAudit(env, who, 'mailbox.renew', `#${box.box_no}`, `${term} months · paid through ${paid_through}`);
      return json({ ok: true, paid_through });
    }
    if (b.action === 'close') {
      if (!box || box.status !== 'active') return json({ error: 'No such open box' }, 404);
      await updateMailbox(env, box.id, { status: 'closed', closed_at: new Date().toISOString() });
      await logAudit(env, who, 'mailbox.close', `#${box.box_no}`, null);
      return json({ ok: true });
    }
    if (b.action === 'remind') {
      if (!box || box.status !== 'active') return json({ error: 'No such open box' }, 404);
      const stage = boxStatus(box, today) === 'overdue' ? 'over' : String(Math.max(0, Math.round((Date.parse(box.paid_through) - Date.parse(today)) / 86_400_000)));
      const sent = await sendReminder(box, `${box.paid_through}:${stage}`);
      await logAudit(env, who, 'mailbox.remind', `#${box.box_no}`, `by hand · text ${sent.sms ? 'sent' : 'no phone'} · email ${sent.email ? 'sent' : 'no email'}`);
      return json({ ok: true, ...sent });
    }
    if (b.action === 'send_due') {
      const out: { box_no: number; name: string; key: string; sms: boolean; email: boolean }[] = [];
      for (const x of await listActiveMailboxes(env)) {
        const reminders: string[] = JSON.parse(x.reminders);
        const key = dueReminder({ ...x, reminders }, today);
        if (!key) continue;
        const sent = await sendReminder(x, key);
        await updateMailbox(env, x.id, { reminders: JSON.stringify([...reminders, key].slice(-20)) });
        out.push({ box_no: x.box_no, name: sent.to, key, sms: sent.sms, email: sent.email });
      }
      await logAudit(env, who, 'mailbox.send_due', null, out.length ? out.map((o) => `#${o.box_no} (${o.key.split(':')[1]})`).join(', ') : 'none due');
      return json({ ok: true, sent: out });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message ?? 'Try again' }, /already in use/.test(e?.message ?? '') ? 409 : 500);
  }
};
