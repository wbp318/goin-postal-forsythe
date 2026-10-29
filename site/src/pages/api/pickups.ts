export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json, parseAddress } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { getAccount, createPickup, getPickup, listPickups, updatePickup, lastPickupFor, logAudit, newPickupCode, type PickupRow } from '../../shipping/store';
import { effectiveAddons } from '../../lib/addons';
import { sendSms, normalizePhone } from '../../shipping/notify';
import { store } from '../../data/store';

// Pickup scheduling for business accounts (to-do T15). Staff schedule from /counter/pickups (or the
// account's software from /api/v1/pickups); the page for a day is the driver's route; On the way
// texts the customer; Picked up records the count. The pickup fee comes from the add-on catalog's
// `pickup` item when Rin sets one, and is written on the row for the statement.
//   list { date }, create { account_id, date, window, address, phone, packages, notes }, on_the_way { code },
//   picked_up { code, packages }, missed { code }, cancel { code, reason }, last { account_id }
export const WINDOWS = ['morning', 'afternoon'];
export const onTheWayText = (p: PickupRow) => `${store.name}: our driver is on the way for your ${p.window} pickup (${p.code}). Have the ${p.packages} package${p.packages === 1 ? '' : 's'} ready at ${JSON.parse(p.address_json).line_1}. Questions: ${store.phone}.`;

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'list') return json({ pickups: await listPickups(env, String(b.date ?? '').slice(0, 10) || undefined) });
    if (b.action === 'last') return json({ pickup: await lastPickupFor(env, Number(b.account_id)) });
    if (b.action === 'create') {
      const account = await getAccount(env, Number(b.account_id));
      if (!account || !account.active) throw new Error('Pick an open business account');
      const date = String(b.date ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toISOString().slice(0, 10)) throw new Error('Pick a date from today on');
      const address = parseAddress({ ...b.address, contact_name: b.address?.contact_name || account.business_name, country_alpha2: b.address?.country_alpha2 || 'US' });
      const fee = (await effectiveAddons(env)).items.find((i) => i.active && i.code === 'pickup')?.price ?? 0;
      const p = await createPickup(env, {
        code: newPickupCode(), account_id: account.id, account_name: account.business_name, scheduled_date: date,
        window: WINDOWS.includes(b.window) ? b.window : 'morning', address_json: JSON.stringify(address), phone: String(b.phone ?? '').trim().slice(0, 20) || null,
        packages: Math.min(500, Math.max(1, Math.floor(Number(b.packages)) || 1)), notes: String(b.notes ?? '').trim().slice(0, 300) || null, fee_usd: fee, by_name: user.name,
      });
      await logAudit(env, user, 'pickup.schedule', p.code, `${account.business_name} ${date} ${p.window}, ${p.packages} packages`);
      return json({ ok: true, pickup: p });
    }
    const p = await getPickup(env, String(b.code ?? ''));
    if (!p) return json({ error: 'No such pickup' }, 404);
    const t = new Date().toISOString();
    let patch: Partial<PickupRow> = {}, note = '';
    if (b.action === 'on_the_way') {
      if (p.status !== 'scheduled') throw new Error(`This pickup is ${p.status}`);
      patch = { status: 'on_the_way', on_the_way_at: t, driver: String(b.driver ?? '').trim().slice(0, 40) || user.name };
      if (p.phone && normalizePhone(p.phone).length >= 11) { const mock = await sendSms(env, normalizePhone(p.phone), onTheWayText(p)); patch.texted_at = t; note = mock ? 'text logged (mock)' : 'texted'; }
    } else if (b.action === 'picked_up') {
      if (p.status !== 'scheduled' && p.status !== 'on_the_way') throw new Error(`This pickup is ${p.status}`);
      patch = { status: 'picked_up', picked_up_at: t, packages: Math.min(500, Math.max(0, Math.floor(Number(b.packages)) || p.packages)), driver: p.driver ?? user.name }; note = `${patch.packages} packages`;
    } else if (b.action === 'missed') {
      patch = { status: 'missed', notes: [p.notes, `Missed: ${String(b.reason ?? '').trim().slice(0, 200)}`].filter(Boolean).join('\n') };
    } else if (b.action === 'cancel') {
      const reason = String(b.reason ?? '').trim().slice(0, 200);
      if (!reason) throw new Error('A reason is needed');
      patch = { status: 'cancelled', notes: [p.notes, `Cancelled: ${reason}`].filter(Boolean).join('\n') }; note = reason;
    } else return json({ error: 'Unknown action' }, 400);
    const next = await updatePickup(env, p.code, patch);
    await logAudit(env, user, `pickup.${b.action}`, p.code, note || undefined);
    return json({ ok: true, pickup: next });
  } catch (e: any) {
    return json({ error: e.message }, /Pick|needed|is |Missing|must be/.test(e.message ?? '') ? 400 : 500);
  }
};
