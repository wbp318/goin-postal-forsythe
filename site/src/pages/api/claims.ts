export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { getOrder } from '../../lib/orders';
import { createClaim, getClaim, listClaims, updateClaim, getShipment, getContacts, logAudit, newClaimCode, REMIND_DAYS, type ClaimRow } from '../../shipping/store';
import { sendEmail } from '../../shipping/notify';
import { store } from '../../data/store';

// Claims (to-do T13): a package lost, damaged or short. One row per claim, from "open" at the
// counter to filed with the carrier, decided, the customer refunded, closed. The list flags claims
// filed more than REMIND_DAYS ago with no decision, so somebody chases the carrier. Staff PIN, audited.
//   list, get { code }, create { shipment, kind, claimed_usd, notes }, file { code, carrier_claim_number },
//   decide { code, outcome: approved|denied, carrier_paid_usd }, refund { code, amount, via, email? }, note { code, notes }, close { code }
const KINDS = ['lost', 'damaged', 'missing_contents'];
const VIAS = ['pos', 'stripe', 'account_credit', 'check'];
const money = (v: unknown, what: string, max = 100000) => { const n = Math.round(Number(v) * 100) / 100; if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${what} must be a number up to ${max}`); return n; };

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'list') return json({ claims: await listClaims(env, b.all === true), remind_days: REMIND_DAYS });
    if (b.action === 'create') {
      const id = String(b.shipment ?? '').trim().toUpperCase();
      const s = await getShipment(env, id);
      const o = await getOrder(env, id);
      if (!s || !o) throw new Error('No such shipment');
      if (!KINDS.includes(b.kind)) throw new Error('Kind must be lost, damaged or missing_contents');
      const c = await getContacts(env, id);
      const dest = JSON.parse(s.destination_json);
      const declared = o.insurance?.declared_usd ?? o.parcel.value_usd ?? 0;
      const claimed = b.claimed_usd == null || b.claimed_usd === '' ? Math.round((declared + s.price) * 100) / 100 : money(b.claimed_usd, 'Amount claimed');
      const row = await createClaim(env, {
        code: newClaimCode(), shipment_id: id, kind: b.kind, carrier: s.carrier, tracking_number: s.tracking_number,
        declared_usd: declared, postage_usd: s.price, claimed_usd: claimed,
        customer_name: o.name || dest.contact_name || null, customer_email: o.email || c?.email || null, customer_phone: o.phone || c?.phone || null,
        insured: o.insurance ? 1 : 0, notes: String(b.notes ?? '').trim().slice(0, 500) || null, by_name: user.name,
      });
      await logAudit(env, user, 'claim.open', row.code, `${id} ${b.kind} $${claimed.toFixed(2)}`);
      return json({ ok: true, claim: row });
    }
    const claim = await getClaim(env, String(b.code ?? ''));
    if (!claim) return json({ error: 'No such claim' }, 404);
    if (b.action === 'get') return json({ claim, shipment: await getShipment(env, claim.shipment_id) });
    let patch: Partial<ClaimRow> = {}, audit = '';
    const t = new Date().toISOString();
    if (b.action === 'file') {
      const n = String(b.carrier_claim_number ?? '').trim().slice(0, 60);
      if (!n) throw new Error("The carrier's claim number is needed");
      patch = { status: 'filed', carrier_claim_number: n, filed_at: claim.filed_at ?? t }; audit = `filed with ${claim.carrier} as ${n}`;
    } else if (b.action === 'decide') {
      if (claim.status !== 'filed') throw new Error('File the claim with the carrier first');
      if (b.outcome === 'approved') { const paid = money(b.carrier_paid_usd, 'Amount the carrier paid'); patch = { status: 'approved', decided_at: t, carrier_paid_usd: paid }; audit = `approved, carrier pays $${paid.toFixed(2)}`; }
      else if (b.outcome === 'denied') { patch = { status: 'denied', decided_at: t, carrier_paid_usd: 0 }; audit = 'denied'; }
      else throw new Error('Outcome must be approved or denied');
    } else if (b.action === 'refund') {
      const amount = money(b.amount, 'Refund amount');
      if (!VIAS.includes(b.via)) throw new Error('Refund via must be pos, stripe, account_credit or check');
      patch = { status: 'refunded', customer_refund_usd: amount, refund_via: b.via, refunded_at: t }; audit = `customer refunded $${amount.toFixed(2)} via ${b.via}`;
      const to = String(b.email ?? claim.customer_email ?? '').trim();
      if (to && (b.notify === true || b.notify === 'on')) {
        await sendEmail(env, to, `Your claim ${claim.code} at ${store.name}`, `${store.name} has refunded $${amount.toFixed(2)} for shipment ${claim.shipment_id} (${claim.kind.replace('_', ' ')}), ${b.via === 'pos' ? 'at the counter' : b.via === 'stripe' ? 'to the card you paid with' : b.via === 'account_credit' ? 'as a credit on your account' : 'by check'}. Questions: ${store.phone}.`);
        patch.customer_notified_at = t;
      }
    } else if (b.action === 'close') {
      patch = { status: 'closed', closed_at: t }; audit = 'closed';
    } else if (b.action === 'note') {
      patch = { notes: String(b.notes ?? '').trim().slice(0, 500) || null }; audit = 'note';
    } else return json({ error: 'Unknown action' }, 400);
    const next = await updateClaim(env, claim.code, patch);
    await logAudit(env, user, `claim.${b.action}`, claim.code, audit);
    return json({ ok: true, claim: next });
  } catch (e: any) {
    return json({ error: e.message }, /must be|needed|first|No such/.test(e.message ?? '') ? 400 : 500);
  }
};
