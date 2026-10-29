export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';
import { json, parseAddress, parseParcel } from '../../../lib/validate';
import { quote } from '../../../lib/quote';
import { newOrderId, saveOrder, getOrder, type Order } from '../../../lib/orders';
import { fulfil } from '../../../lib/fulfil';
import { effectiveAddons, priceExtras } from '../../../lib/addons';
import { checkAddress } from '../../../lib/address';
import { voidLabel, track } from '../../../shipping/engine';
import { store } from '../../../data/store';
import { X402_PRICES, x402Mode, charge, paidJson, requirements, paymentRequired } from '../../../lib/x402';
import { findShipment, getShipment, listTrackingEvents, addTrackingEvents, setShipmentStatus, setX402PaymentShipment, findX402PaymentByTx, markX402Refund, logAudit } from '../../../shipping/store';

// Pay-per-request API for software and agents (x402). No account, no key: each call carries a USDC
// payment, verified and settled by a facilitator before the work is done. Humans keep paying by card.
//
//   GET  /api/x402/prices                 free     the price list, mode, network, receiving address
//   GET  /api/x402/store                  $0.001   store facts: name, address, phone, hours, services
//   POST /api/x402/rates                  $0.01    { to, parcel } -> retail rates
//   GET  /api/x402/track/:code-or-number  $0.005   tracking events
//   POST /api/x402/shipments              label    { to, parcel, rate_id, email?, reference?, insure? } first call answers 402 with the exact price, the paid retry buys the label
//   POST /api/x402/shipments/:id/void     free     { tx_hash, reason } within 24 hours; the refund goes back to the payer by hand, listed for the owner
// Plan, prices, money and the Kraken/facilitator split: monetization/x402/README.md.
const who = { id: null, name: 'x402 agent' };
const addr = (v: any) => (v && typeof v === 'object' ? { ...v, contact_name: v.contact_name ?? v.name, contact_phone: v.contact_phone ?? v.phone, contact_email: v.contact_email ?? v.email } : v);

export const ALL: APIRoute = async ({ request, params }) => {
  const path = (params.path ?? '').replace(/\/+$/, '');
  const seg = path.split('/').filter(Boolean);
  const body: any = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  try {
    if (request.method === 'GET' && path === 'prices') {
      const mode = x402Mode(env);
      return json({ mode, network: env.X402_NETWORK || 'base', pay_to: env.X402_PAY_TO ?? null, currency: 'USDC', prices: { ...X402_PRICES, shipments: 'the label price, quoted per call' },
        endpoints: ['GET /api/x402/store', 'POST /api/x402/rates', 'GET /api/x402/track/:id', 'POST /api/x402/shipments', 'POST /api/x402/shipments/:id/void'],
        how: 'Call an endpoint; a 402 answer carries the price and terms; retry with the signed payment in the X-PAYMENT header (PAYMENT-SIGNATURE also accepted). Receipts come back in PAYMENT-RESPONSE.',
        refunds: 'A label can be voided within 24 hours if unused; the USDC goes back to the paying address. Store facts, rates and tracking are not refundable.',
        docs: 'https://github.com/wbp318/goin-postal-forsythe/blob/main/monetization/x402/README.md' });
    }

    if (request.method === 'GET' && path === 'store') {
      const c = await charge(env, request, 'store', X402_PRICES.store, `${store.name}: hours, services, address`);
      if ('response' in c) return c.response;
      return paidJson({ name: store.name, address: store.address, phone: store.phone, email: store.email, site: env.SITE_URL, hours: store.hours.map((h) => ({ days: h.days, open: h.open })), services: store.services.map((s) => ({ name: s.name, blurb: s.blurb })) }, c.settlement);
    }

    if (request.method === 'POST' && path === 'rates') {
      const to = parseAddress(addr(body.to)), parcel = parseParcel(body.parcel);
      const c = await charge(env, request, 'rates', X402_PRICES.rates, `Shipping rates from ${store.name}`);
      if ('response' in c) return c.response;
      const check = checkAddress(to);
      const { rates, demo } = await quote(env, store.origin, to, parcel);
      const offered = (check.po_box || check.military ? rates.filter((r) => r.carrier === 'USPS') : rates).map((r) => ({ id: r.id, carrier: r.carrier, service: r.service, price: r.total_charge, currency: r.currency, min_days: r.min_days, max_days: r.max_days }));
      return paidJson({ rates: offered, demo, address: { errors: check.errors, warnings: check.warnings } }, c.settlement);
    }

    if (request.method === 'GET' && seg[0] === 'track' && seg[1]) {
      const c = await charge(env, request, 'track', X402_PRICES.track, 'Tracking events');
      if ('response' in c) return c.response;
      const s = await findShipment(env, decodeURIComponent(seg[1]));
      if (!s) return paidJson({ error: 'Not found' }, c.settlement, 404);
      let events = await listTrackingEvents(env, s.id);
      const done = s.status === 'delivered' || s.status === 'voided';
      if (!done && s.label_id && s.tracking_number && (!events.length || Date.now() - new Date(s.updated_at).getTime() > 15 * 60_000)) {
        try { const added = await addTrackingEvents(env, s.id, await track(env, s.label_id, s.tracking_number)); if (added.length) events = await listTrackingEvents(env, s.id); } catch { /* stored events are the answer */ }
      }
      return paidJson({ id: s.id, carrier: s.carrier, service: s.service, tracking_number: s.tracking_number, status: events[0]?.status ?? s.status, events }, c.settlement);
    }

    if (request.method === 'POST' && path === 'shipments') {
      const to = parseAddress(addr(body.to)), parcel = parseParcel(body.parcel);
      const check = checkAddress(to);
      if (check.errors.length) return json({ error: check.errors[0] }, 400);
      if (to.country_alpha2 !== 'US') return json({ error: 'International shipments need customs paperwork; bring them to the counter for now' }, 400);
      const { rates } = await quote(env, store.origin, to, parcel);
      const rate = rates.find((r) => r.id === body.rate_id);
      if (!rate) return json({ error: 'rate_id is not one of the rates for this parcel; call /rates first' }, 400);
      const extras = priceExtras(await effectiveAddons(env), body.addons, parcel.value_usd, body.insure === true);
      const total = Math.round((rate.total_charge + extras.extras_total) * 100) / 100;
      const desc = `${rate.carrier} ${rate.service} label from ${store.name}, drop at the counter or scheduled pickup; void within 24 hours if unused`;
      // Settle first. The 402 carries the exact price for this rate so the agent sees it before paying.
      const c = await charge(env, request, 'shipments', total, desc);
      if ('response' in c) return c.response;
      const order: Order = {
        id: newOrderId(), status: 'reserved', created_at: new Date().toISOString(), email: String(body.email ?? '').trim(), name: String(body.name ?? 'x402 agent').slice(0, 60),
        source: 'counter', staff: 'x402', origin: store.origin, destination: to, parcel, rate, international: false, kind: 'ship',
        addons: extras.addons.length ? extras.addons : undefined, insurance: extras.insurance, total,
      };
      try {
        await saveOrder(env, order);
        const done = await fulfil(env, { ...order, paid_at: new Date().toISOString() }, 'mock');
        await setX402PaymentShipment(env, c.payment.id, done.id);
        await logAudit(env, who, 'label.buy', done.id, `x402 ${c.settlement.tx}, ${rate.carrier} ${rate.service} $${total.toFixed(2)}${body.reference ? `, ref ${String(body.reference).slice(0, 40)}` : ''}`);
        const s = await getShipment(env, done.id);
        return paidJson({ shipment: { id: done.id, status: s?.status ?? 'labeled', carrier: rate.carrier, service: rate.service, tracking_number: s?.tracking_number ?? null, total, label_url: done.label?.label_url ? (done.label.label_url.startsWith('/') ? `${env.SITE_URL}${done.label.label_url}` : done.label.label_url) : null, label_zpl: done.label?.label_zpl ?? null, track_url: `${env.SITE_URL}/track?q=${done.id}`, pickup_code: done.id, drop_off: `${store.name}, ${store.address}`, void_until: new Date(Date.now() + 24 * 3600_000).toISOString(), tx: c.settlement.tx } }, c.settlement, 201);
      } catch (e: any) {
        // Paid but no label: the owner refunds the payer by hand; it is listed on the reports page.
        await markX402Refund(env, c.payment.id, `label failed: ${e.message}`);
        return paidJson({ error: `Payment settled but the label could not be bought (${e.message}). The store will refund ${c.settlement.payer} for transaction ${c.settlement.tx}.` }, c.settlement, 502);
      }
    }

    if (request.method === 'POST' && seg[0] === 'shipments' && seg[1] && seg[2] === 'void') {
      const id = seg[1].toUpperCase();
      const tx = String(body.tx_hash ?? '').trim(), reason = String(body.reason ?? '').trim().slice(0, 200);
      if (!tx || !reason) return json({ error: 'tx_hash (from the purchase receipt) and a reason are needed' }, 400);
      const p = await findX402PaymentByTx(env, tx);
      if (!p || p.shipment_id !== id) return json({ error: 'No such shipment for that transaction' }, 404);
      if (Date.now() - new Date(p.at).getTime() > 24 * 3600_000) return json({ error: 'The 24-hour void window has passed' }, 400);
      const order = await getOrder(env, id);
      if (!order?.label || (order.status !== 'labeled' && order.status !== 'printed')) return json({ error: `Cannot void a shipment that is ${order?.status ?? 'unknown'}` }, 400);
      await voidLabel(env, order.label.id);
      await saveOrder(env, { ...order, status: 'voided', voided_at: new Date().toISOString(), void_reason: reason });
      await setShipmentStatus(env, id, 'voided');
      await markX402Refund(env, p.id, `voided: ${reason}`);
      await logAudit(env, who, 'label.void', id, `x402 ${tx}: ${reason}; refund owed to ${p.payer}`);
      return json({ ok: true, id, status: 'voided', refund: { amount_usd: p.amount_usd, to: p.payer, how: 'sent back by the store to the paying address, usually the same day' } });
    }

    // A friendly 402 for a paid path called with the wrong method, so an agent learns the price anyway.
    if (['store', 'rates'].includes(seg[0]) || seg[0] === 'track') return paymentRequired(requirements(env, `/api/x402/${path}`, (X402_PRICES as any)[seg[0]] ?? 0, 'See GET /api/x402/prices'), `Use ${seg[0] === 'rates' ? 'POST' : 'GET'} for this endpoint`);
    return json({ error: `No such endpoint: ${request.method} /api/x402/${path}` }, 404);
  } catch (e: any) {
    return json({ error: e.message }, e.message?.startsWith('Missing') || /must be|ZIP|no longer/.test(e.message ?? '') ? 400 : 500);
  }
};
