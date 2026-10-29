#!/usr/bin/env node
// PeterShip eBay connector v1.66.0 (to-do T28). Pulls a seller's unshipped eBay orders through the
// Sell Fulfillment API, buys labels through the PeterShip public API, and marks each order shipped
// on eBay with the carrier and tracking number. Node 24, no packages. Same shape as the Square and
// Shopify connectors.
//   node connector.mjs --once      one pass
//   node connector.mjs             every 5 minutes
// Config: config.json beside this file (see config.example.json); PETERSHIP_KEY, EBAY_CLIENT_ID,
// EBAY_CLIENT_SECRET and EBAY_REFRESH_TOKEN may come from the environment. The refresh token comes
// from eBay's OAuth consent flow once (the README says how); the connector mints access tokens from it.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = process.argv.find((a) => a.endsWith('.json')) ?? join(here, 'config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
for (const k of ['petership_key', 'ebay_client_id', 'ebay_client_secret', 'ebay_refresh_token']) cfg[k] = process.env[k.toUpperCase()] ?? cfg[k];
cfg.ebay_env ??= 'production';
cfg.service ??= 'cheapest';
cfg.default_parcel ??= { length_in: 10, width_in: 8, height_in: 4, min_weight_lb: 0.5, weight_per_item_lb: 0.5 };
const once = process.argv.includes('--once');
const EBAY = cfg.ebay_env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const donePath = join(here, 'shipped.json');
const done = new Set(existsSync(donePath) ? JSON.parse(readFileSync(donePath, 'utf8')) : []);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

let access = { token: null, until: 0 };
async function accessToken() {
  if (access.token && Date.now() < access.until - 60_000) return access.token;
  const res = await fetch(`${EBAY}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${cfg.ebay_client_id}:${cfg.ebay_client_secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cfg.ebay_refresh_token, scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment' }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`eBay token: ${res.status} ${j.error_description ?? j.error ?? ''}`);
  access = { token: j.access_token, until: Date.now() + (Number(j.expires_in) || 7200) * 1000 };
  return access.token;
}
async function ebay(path, body) {
  const res = await fetch(`${EBAY}/sell/fulfillment/v1${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', 'Content-Language': 'en-US' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const j = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`eBay ${path}: ${res.status} ${(j.errors ?? []).map((e) => e.message).join('; ') || text.slice(0, 200)}`);
  return j;
}
async function petership(path, body) {
  const res = await fetch(`${cfg.petership_url}/api/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${cfg.petership_key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PeterShip ${path}: ${j.error ?? res.status}`);
  return j;
}

/** eBay orders carry no weight; per-SKU overrides or a default box plus a weight per item. */
function parcelFor(order) {
  const d = cfg.default_parcel;
  let weight = 0, dims = null;
  for (const li of order.lineItems ?? []) {
    const qty = Number(li.quantity) || 1;
    const o = cfg.products?.[li.sku] ?? cfg.products?.[li.title];
    weight += (o?.weight_lb ?? d.weight_per_item_lb ?? 0.5) * qty;
    if (o && !dims) dims = o;
  }
  const box = dims ?? d;
  const total = Number(order.pricingSummary?.total?.value ?? 0);
  return { length_in: box.length_in, width_in: box.width_in, height_in: box.height_in, weight_lb: Math.max(weight, d.min_weight_lb ?? 0.5, 0.1), value_usd: total || undefined };
}
function addressFor(order) {
  const step = order.fulfillmentStartInstructions?.[0]?.shippingStep;
  const to = step?.shipTo, a = to?.contactAddress;
  if (!a) throw new Error('no ship-to address');
  return { name: to.fullName || 'Customer', line_1: a.addressLine1, line_2: a.addressLine2 || undefined, city: a.city, state: a.stateOrProvince, postal_code: a.postalCode, country_alpha2: a.countryCode || 'US', phone: to.primaryPhone?.phoneNumber || '', email: to.email || undefined };
}
function pick(rates) {
  if (!rates.length) throw new Error('no rates');
  if (cfg.service === 'cheapest') return [...rates].sort((a, b) => a.price - b.price)[0];
  if (cfg.service === 'fastest') return [...rates].sort((a, b) => (a.max_days ?? 99) - (b.max_days ?? 99) || a.price - b.price)[0];
  const r = rates.find((x) => x.id === cfg.service);
  if (!r) throw new Error(`service ${cfg.service} not offered for this parcel`);
  return r;
}
// eBay's carrier codes for the fulfillment call.
const CARRIER = { USPS: 'USPS', UPS: 'UPS', FedEx: 'FedEx', DHL: 'DHL' };

async function shipOrder(order) {
  const ref = `eBay ${order.orderId}`;
  const to = addressFor(order);
  if (to.country_alpha2 !== 'US') throw new Error('international: bring to the counter');
  const parcel = parcelFor(order);
  const { rates, demo } = await petership('rates', { to, parcel });
  const rate = pick(rates);
  if (cfg.dry_run) { log(`${ref}: would ship ${rate.carrier} ${rate.service} $${rate.price}${demo ? ' (demo prices)' : ''}`); return; }
  const { shipment } = await petership('shipments', { to, parcel, rate_id: rate.id, reference: ref, insure: cfg.insure_over_usd > 0 && (parcel.value_usd ?? 0) > cfg.insure_over_usd, email: to.email });
  done.add(order.orderId); writeFileSync(donePath, JSON.stringify([...done]));
  await ebay(`/order/${order.orderId}/shipping_fulfillment`, {
    lineItems: (order.lineItems ?? []).map((li) => ({ lineItemId: li.lineItemId, quantity: Number(li.quantity) || 1 })),
    shippedDate: new Date().toISOString(),
    shippingCarrierCode: CARRIER[shipment.carrier] ?? shipment.carrier,
    trackingNumber: shipment.tracking_number ?? undefined,
  });
  log(`${ref}: ${shipment.id} ${shipment.carrier} ${shipment.service} ${shipment.tracking_number} $${shipment.total}`);
}

async function pass() {
  const q = new URLSearchParams({ filter: 'orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}', limit: '50' });
  const { orders = [] } = await ebay(`/order?${q}`);
  const todo = orders.filter((o) => !done.has(o.orderId) && o.orderPaymentStatus === 'PAID' && (o.cancelStatus?.cancelState ?? 'NONE_REQUESTED') === 'NONE_REQUESTED');
  log(`${todo.length} order(s) to ship${cfg.dry_run ? ' (dry run)' : ''}`);
  for (const o of todo) {
    try { await shipOrder(o); } catch (e) { log(`eBay ${o.orderId}: skipped, ${e.message}`); }
  }
}

const me = await petership('me');
log(`PeterShip account: ${me.account.business_name} (${me.account.discount_percent}% off), key ${me.key.label}; eBay ${cfg.ebay_env}`);
await pass();
if (!once) setInterval(() => pass().catch((e) => log('pass failed:', e.message)), 5 * 60 * 1000);
