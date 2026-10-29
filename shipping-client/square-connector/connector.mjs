#!/usr/bin/env node
// PeterShip Square connector v1.64.0 (to-do T28). Pulls a Square Online seller's open shipment
// orders, buys labels through the PeterShip public API, and writes the tracking back to Square on
// the order's fulfillment. Node 24, no packages. Same shape as the Shopify connector.
//   node connector.mjs --once      one pass
//   node connector.mjs             every 5 minutes
// Config: config.json beside this file (see config.example.json); PETERSHIP_KEY and SQUARE_TOKEN may come from the environment.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = process.argv.find((a) => a.endsWith('.json')) ?? join(here, 'config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.petership_key = process.env.PETERSHIP_KEY ?? cfg.petership_key;
cfg.square_token = process.env.SQUARE_TOKEN ?? cfg.square_token;
cfg.square_env ??= 'production';
cfg.service ??= 'cheapest';
cfg.default_parcel ??= { length_in: 10, width_in: 8, height_in: 4, min_weight_lb: 0.5, weight_per_item_lb: 0.5 };
const once = process.argv.includes('--once');
const SQ = cfg.square_env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
const VERSION = '2025-10-16';
const donePath = join(here, 'shipped.json');   // order ids already shipped, so nothing is bought twice if Square is slow to show the fulfillment
const done = new Set(existsSync(donePath) ? JSON.parse(readFileSync(donePath, 'utf8')) : []);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function square(path, body, method = body ? 'POST' : 'GET') {
  const res = await fetch(`${SQ}/v2${path}`, { method, headers: { Authorization: `Bearer ${cfg.square_token}`, 'Square-Version': VERSION, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Square ${path}: ${res.status} ${(j.errors ?? []).map((e) => e.detail ?? e.code).join('; ') || res.statusText}`);
  return j;
}
async function petership(path, body) {
  const res = await fetch(`${cfg.petership_url}/api/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${cfg.petership_key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PeterShip ${path}: ${j.error ?? res.status}`);
  return j;
}

/** Square orders carry no weight; the parcel comes from per-item overrides by SKU or catalog name, else the default box and a weight per item. */
function parcelFor(order) {
  const d = cfg.default_parcel;
  let weight = 0, dims = null;
  for (const li of order.line_items ?? []) {
    const qty = Number(li.quantity) || 1;
    const o = cfg.products?.[li.catalog_object_id] ?? cfg.products?.[li.name] ?? cfg.products?.[li.variation_name];
    weight += (o?.weight_lb ?? d.weight_per_item_lb ?? 0.5) * qty;
    if (o && !dims) dims = o;
  }
  const box = dims ?? d;
  const total = Number(order.total_money?.amount ?? 0) / 100;
  return { length_in: box.length_in, width_in: box.width_in, height_in: box.height_in, weight_lb: Math.max(weight, d.min_weight_lb ?? 0.5, 0.1), value_usd: total || undefined };
}
function addressFor(f) {
  const r = f.shipment_details?.recipient;
  const a = r?.address;
  if (!a) throw new Error('no shipping address on the fulfillment');
  return { name: r.display_name || 'Customer', line_1: a.address_line_1, line_2: a.address_line_2 || undefined, city: a.locality, state: a.administrative_district_level_1, postal_code: a.postal_code, country_alpha2: a.country || 'US', phone: r.phone_number || '', email: r.email_address || undefined };
}
function pick(rates) {
  if (!rates.length) throw new Error('no rates');
  if (cfg.service === 'cheapest') return [...rates].sort((a, b) => a.price - b.price)[0];
  if (cfg.service === 'fastest') return [...rates].sort((a, b) => (a.max_days ?? 99) - (b.max_days ?? 99) || a.price - b.price)[0];
  const r = rates.find((x) => x.id === cfg.service);
  if (!r) throw new Error(`service ${cfg.service} not offered for this parcel`);
  return r;
}
const label = (order) => `Square ${order.reference_id ?? order.id.slice(0, 8)}`;

async function shipOrder(order) {
  const ref = label(order);
  const f = (order.fulfillments ?? []).find((x) => x.type === 'SHIPMENT' && !x.shipment_details?.tracking_number && x.state !== 'COMPLETED' && x.state !== 'CANCELED');
  if (!f) throw new Error('no open shipment fulfillment');
  const to = addressFor(f);
  if (to.country_alpha2 !== 'US') throw new Error('international: bring to the counter');
  const parcel = parcelFor(order);
  const { rates, demo } = await petership('rates', { to, parcel });
  const rate = pick(rates);
  if (cfg.dry_run) { log(`${ref}: would ship ${rate.carrier} ${rate.service} $${rate.price}${demo ? ' (demo prices)' : ''}`); return; }
  const { shipment } = await petership('shipments', { to, parcel, rate_id: rate.id, reference: ref, insure: cfg.insure_over_usd > 0 && (parcel.value_usd ?? 0) > cfg.insure_over_usd, email: to.email });
  done.add(order.id); writeFileSync(donePath, JSON.stringify([...done]));
  // Tracking back to Square: UpdateOrder with the order's version and the fulfillment's uid.
  await square(`/orders/${order.id}`, {
    idempotency_key: randomUUID(),
    order: { version: order.version, location_id: order.location_id, fulfillments: [{ uid: f.uid, state: 'PREPARED', shipment_details: { carrier: shipment.carrier, tracking_number: shipment.tracking_number ?? undefined, tracking_url: shipment.track_url, shipping_note: `Shipped by ${cfg.store_name ?? 'the store'} via PeterShip` } }] },
  }, 'PUT');
  log(`${ref}: ${shipment.id} ${shipment.carrier} ${shipment.service} ${shipment.tracking_number} $${shipment.total}`);
}

async function pass() {
  const body = { location_ids: cfg.location_ids, query: { filter: { state_filter: { states: ['OPEN'] }, fulfillment_filter: { fulfillment_types: ['SHIPMENT'], fulfillment_states: ['PROPOSED', 'RESERVED', 'PREPARED'] } }, sort: { sort_field: 'CREATED_AT', sort_order: 'ASC' } }, limit: 50 };
  const { orders = [] } = await square('/orders/search', body);
  const todo = orders.filter((o) => !done.has(o.id) && (o.fulfillments ?? []).some((f) => f.type === 'SHIPMENT' && !f.shipment_details?.tracking_number));
  log(`${todo.length} order(s) to ship${cfg.dry_run ? ' (dry run)' : ''}`);
  for (const o of todo) {
    try { await shipOrder(o); } catch (e) { log(`${label(o)}: skipped, ${e.message}`); }
  }
}

const me = await petership('me');
log(`PeterShip account: ${me.account.business_name} (${me.account.discount_percent}% off), key ${me.key.label}; Square ${cfg.square_env}, ${cfg.location_ids.length} location(s)`);
await pass();
if (!once) setInterval(() => pass().catch((e) => log('pass failed:', e.message)), 5 * 60 * 1000);
