export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';
import { json, parseAddress, parseParcel } from '../../../lib/validate';
import { quote } from '../../../lib/quote';
import { newOrderId, saveOrder, getOrder, type Order } from '../../../lib/orders';
import { fulfil } from '../../../lib/fulfil';
import { effectiveAddons, priceExtras, salesTax, taxableExtras } from '../../../lib/addons';
import { checkAddress } from '../../../lib/address';
import { authenticateApi } from '../../../lib/apikeys';
import { voidLabel } from '../../../shipping/engine';
import { store } from '../../../data/store';
import { rateBatch, choose, discounted, MAX_ROWS, type BatchRow, type Pick } from '../../../lib/batch';
import { buyBatchRow } from '../../../lib/batchBuy';
import { billShipmentToAccount, shipmentsForAccount, getShipment, listTrackingEvents, setShipmentStatus, logAudit } from '../../../shipping/store';

// PeterShip public API, version 1. For a business account's own software, a Shopify or Etsy shop,
// or anything else that ships through the store. Bearer token: an API key made on /counter/accounts.
// Every shipment is billed to the account and goes on its next statement, with its discount applied.
//
//   POST /api/v1/rates                      { to, parcel }                         -> rates for this account
//   POST /api/v1/shipments                  { to, parcel, rate_id, reference?, insure?, addons? } -> buys the label now
//   GET  /api/v1/shipments?since=ISO        -> this account's shipments, newest first
//   GET  /api/v1/shipments/:id              -> one shipment with its tracking events
//   POST /api/v1/shipments/:id/void         { reason }
//   POST /api/v1/batches                    { rows: [{ reference?, to, parcel }], pick?: 'cheapest' | 'fastest' | 'USPS Ground Advantage', insure?, dry_run? } -> rates every row, buys the good ones (up to 200)
//   GET  /api/v1/me                         -> the account and key this token belongs to
// Errors are { error: "plain sentence" } with the usual status codes. Webhooks (shipment.tracking) are
// set on the key. Reference: shipping-client/api/README.md.
// The public API accepts the friendlier name/phone/email beside the internal contact_* field names.
const addr = (v: any) => (v && typeof v === 'object' ? { ...v, contact_name: v.contact_name ?? v.name, contact_phone: v.contact_phone ?? v.phone, contact_email: v.contact_email ?? v.email } : v);
const sh = (s: any, events?: unknown[]) => ({
  id: s.id, status: s.status, carrier: s.carrier, service: s.service, tracking_number: s.tracking_number, label_id: s.label_id,
  price: s.price, cost: undefined, created_at: s.created_at, updated_at: s.updated_at, to: JSON.parse(s.destination_json), parcel: JSON.parse(s.parcel_json),
  track_url: `${env.SITE_URL}/track?q=${s.id}`, ...(events ? { events } : {}),
});

export const ALL: APIRoute = async ({ request, params }) => {
  const caller = await authenticateApi(env, request);
  if (!caller) return json({ error: 'A valid API key is needed: Authorization: Bearer psk_...' }, 401);
  const { account, key } = caller;
  const path = (params.path ?? '').replace(/\/+$/, '');
  const seg = path.split('/').filter(Boolean);
  const body: any = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  const who = { id: null, name: `API ${account.business_name} (${key.label})` };
  try {
    if (request.method === 'GET' && path === 'me') return json({ account: { id: account.id, business_name: account.business_name, discount_percent: account.discount_percent }, key: { id: key.id, label: key.label, prefix: key.prefix, webhook_url: key.webhook_url } });

    if (request.method === 'POST' && path === 'rates') {
      const to = parseAddress(addr(body.to)), parcel = parseParcel(body.parcel);
      const check = checkAddress(to);
      const { rates, demo } = await quote(env, store.origin, to, parcel);
      const d = account.discount_percent || 0;
      const offered = (check.po_box || check.military ? rates.filter((r) => r.carrier === 'USPS') : rates).map((r) => ({ id: r.id, carrier: r.carrier, service: r.service, price: Math.round(r.total_charge * (1 - d / 100) * 100) / 100, currency: r.currency, min_days: r.min_days, max_days: r.max_days }));
      return json({ rates: offered, demo, address: { errors: check.errors, warnings: check.warnings } });
    }

    if (request.method === 'POST' && path === 'shipments') {
      const to = parseAddress(addr(body.to)), parcel = parseParcel(body.parcel);
      const check = checkAddress(to);
      if (check.errors.length) return json({ error: check.errors[0] }, 400);
      const { rates } = await quote(env, store.origin, to, parcel);
      const found = rates.find((r) => r.id === body.rate_id);
      if (!found) return json({ error: 'rate_id is not one of the rates for this parcel; call /rates first' }, 400);
      const d = account.discount_percent || 0;
      const rate = d ? { ...found, total_charge: Math.round(found.total_charge * (1 - d / 100) * 100) / 100 } : found;
      const cfg = await effectiveAddons(env);
      const extras = priceExtras(cfg, body.addons, parcel.value_usd, body.insure === true);
      const tax = salesTax(cfg, taxableExtras(extras));
      const order: Order = {
        id: newOrderId(), status: 'reserved', created_at: new Date().toISOString(), email: String(body.email ?? '').trim(), name: account.business_name,
        source: 'counter', staff: `API:${key.label}`.slice(0, 20), origin: store.origin, destination: to, parcel, rate, international: to.country_alpha2 !== 'US', kind: 'ship',
        addons: extras.addons.length ? extras.addons : undefined, insurance: extras.insurance, tax, total: Math.round((rate.total_charge + extras.extras_total + (tax?.amount ?? 0)) * 100) / 100,
        account_id: account.id, account_name: account.business_name, discount_percent: d || undefined,
      };
      if (order.international) return json({ error: 'International shipments need customs paperwork; bring them to the counter for now' }, 400);
      await saveOrder(env, order);
      const done = await fulfil(env, { ...order, paid_at: new Date().toISOString() }, 'account');
      await billShipmentToAccount(env, done.id, account.id);
      await logAudit(env, who, 'label.buy', done.id, `API, ${rate.carrier} ${rate.service} $${(done.total ?? rate.total_charge).toFixed(2)}${body.reference ? `, ref ${String(body.reference).slice(0, 40)}` : ''}`);
      const s = await getShipment(env, done.id);
      return json({ shipment: { ...sh(s), label_url: done.label?.label_url ? (done.label.label_url.startsWith('/') ? `${env.SITE_URL}${done.label.label_url}` : done.label.label_url) : null, label_zpl: done.label?.label_zpl ?? null, total: done.total, reference: body.reference ?? null } }, 201);
    }

    if (request.method === 'POST' && path === 'batches') {
      const list: any[] = Array.isArray(body.rows) ? body.rows : [];
      if (!list.length) return json({ error: 'rows is needed: an array of { reference, to, parcel }' }, 400);
      if (list.length > MAX_ROWS) return json({ error: `At most ${MAX_ROWS} rows per batch` }, 400);
      const pick: Pick = body.pick === 'fastest' ? 'fastest' : !body.pick || body.pick === 'cheapest' ? 'cheapest' : { service: String(body.pick) };
      const rows: BatchRow[] = list.map((r, i) => {
        const row: BatchRow = { line: i + 1, reference: String(r?.reference ?? '').slice(0, 40), to: null, parcel: null, errors: [], warnings: [] };
        try { row.to = parseAddress(addr(r?.to)); const c = checkAddress(row.to); row.errors.push(...c.errors); row.warnings.push(...c.warnings); } catch (e: any) { row.errors.push(e.message); }
        try { row.parcel = parseParcel(r?.parcel); } catch (e: any) { row.errors.push(e.message); }
        if (row.to && row.to.country_alpha2 !== 'US') row.errors.push('International rows need customs paperwork; bring them to the counter');
        return row;
      });
      const rated = await rateBatch(env, rows, pick, account.discount_percent || 0);
      const batch = `B-${Date.now().toString(36).toUpperCase()}`;
      const results = [];
      for (const r of rated) {
        if (!r.chosen || r.errors.length || !r.to || !r.parcel) { results.push({ line: r.line, reference: r.reference, id: null, carrier: r.chosen?.carrier ?? null, service: r.chosen?.service ?? null, tracking_number: null, price: r.chosen?.total_charge ?? null, label_url: null, error: r.errors[0] ?? 'No rate' }); continue; }
        if (body.dry_run === true) { results.push({ line: r.line, reference: r.reference, id: null, carrier: r.chosen.carrier, service: r.chosen.service, tracking_number: null, price: r.chosen.total_charge, label_url: null, error: null }); continue; }
        try { results.push(await buyBatchRow(env, { to: r.to, parcel: r.parcel, rate: r.chosen, reference: r.reference, account, batch, who, print: false, insure: body.insure === true, line: r.line })); }
        catch (e: any) { results.push({ line: r.line, reference: r.reference, id: null, carrier: null, service: null, tracking_number: null, price: null, label_url: null, error: e.message }); }
      }
      const bought = results.filter((x) => x.id);
      if (!body.dry_run) await logAudit(env, who, 'batch.buy', batch, `API ${account.business_name}: ${bought.length} of ${results.length} labels`);
      return json({ batch: body.dry_run ? null : batch, dry_run: body.dry_run === true, results, bought: bought.length, failed: results.length - bought.length, total: Math.round(results.reduce((a, x) => a + (x.id || body.dry_run ? (x.price ?? 0) : 0), 0) * 100) / 100 }, body.dry_run ? 200 : 201);
    }

    if (request.method === 'GET' && path === 'shipments') {
      const since = typeof body.since === 'string' ? body.since : new URL(request.url).searchParams.get('since') ?? undefined;
      const list = await shipmentsForAccount(env, account.id, since ?? undefined);
      return json({ shipments: list.map((s) => sh(s)) });
    }

    if (seg[0] === 'shipments' && seg[1]) {
      const s = await getShipment(env, seg[1].toUpperCase());
      const mine = s && (await shipmentsForAccount(env, account.id)).some((x) => x.id === s.id);
      if (!s || !mine) return json({ error: 'No such shipment on this account' }, 404);
      if (request.method === 'GET' && !seg[2]) return json({ shipment: sh(s, await listTrackingEvents(env, s.id)) });
      if (request.method === 'POST' && seg[2] === 'void') {
        const reason = String(body.reason ?? '').trim().slice(0, 200);
        if (!reason) return json({ error: 'A reason is needed' }, 400);
        const order = await getOrder(env, s.id);
        if (!order?.label || (order.status !== 'labeled' && order.status !== 'printed')) return json({ error: `Cannot void a shipment that is ${s.status}` }, 400);
        await voidLabel(env, order.label.id);
        await saveOrder(env, { ...order, status: 'voided', voided_at: new Date().toISOString(), void_reason: reason });
        await setShipmentStatus(env, s.id, 'voided');
        await logAudit(env, who, 'label.void', s.id, `API: ${reason}`);
        return json({ ok: true, id: s.id, status: 'voided' });
      }
    }
    return json({ error: `No such endpoint: ${request.method} /api/v1/${path}` }, 404);
  } catch (e: any) {
    return json({ error: e.message }, e.message?.startsWith('Missing') || /must be|ZIP|no longer/.test(e.message ?? '') ? 400 : 500);
  }
};
