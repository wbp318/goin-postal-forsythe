#!/usr/bin/env node
// PeterShip Shopify connector v1.40.0. Pulls a shop's unfulfilled orders, buys labels through the
// PeterShip public API, and writes the tracking back to Shopify as fulfilments. Node 24, no packages.
//   node connector.mjs --once      one pass
//   node connector.mjs             every 5 minutes
// Config: config.json beside this file (see config.example.json); PETERSHIP_KEY and SHOPIFY_TOKEN may come from the environment.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = process.argv.find((a) => a.endsWith('.json')) ?? join(here, 'config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.petership_key = process.env.PETERSHIP_KEY ?? cfg.petership_key;
cfg.shopify_token = process.env.SHOPIFY_TOKEN ?? cfg.shopify_token;
cfg.tag ??= 'petership';
cfg.service ??= 'cheapest';
cfg.default_parcel ??= { length_in: 10, width_in: 8, height_in: 4, min_weight_lb: 0.5 };
const once = process.argv.includes('--once');
const API = '2025-10';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function shopify(path, init = {}) {
  const res = await fetch(`https://${cfg.shop}/admin/api/${API}${path}`, { ...init, headers: { 'X-Shopify-Access-Token': cfg.shopify_token, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`Shopify ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}
async function petership(path, body) {
  const res = await fetch(`${cfg.petership_url}/api/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${cfg.petership_key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PeterShip ${path}: ${j.error ?? res.status}`);
  return j;
}

const gramsToLb = (g) => (Number(g) || 0) / 453.592;
function parcelFor(order) {
  const d = cfg.default_parcel;
  let weight = 0, dims = null;
  for (const li of order.line_items) {
    const o = cfg.products?.[li.sku];
    weight += (o?.weight_lb ?? gramsToLb(li.grams)) * li.quantity;
    if (o && !dims) dims = o;
  }
  const box = dims ?? d;
  return { length_in: box.length_in, width_in: box.width_in, height_in: box.height_in, weight_lb: Math.max(weight, d.min_weight_lb ?? 0.5, 0.1), value_usd: Number(order.total_price) || undefined };
}
function addressFor(order) {
  const a = order.shipping_address;
  if (!a) throw new Error('no shipping address');
  return { name: a.name || `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim(), company: a.company || undefined, line_1: a.address1, line_2: a.address2 || undefined, city: a.city, state: a.province_code, postal_code: a.zip, country_alpha2: a.country_code, phone: a.phone || order.phone || order.customer?.phone || '', email: order.email || undefined };
}
function pick(rates) {
  if (!rates.length) throw new Error('no rates');
  if (cfg.service === 'cheapest') return [...rates].sort((a, b) => a.price - b.price)[0];
  if (cfg.service === 'fastest') return [...rates].sort((a, b) => (a.max_days ?? 99) - (b.max_days ?? 99) || a.price - b.price)[0];
  const r = rates.find((x) => x.id === cfg.service);
  if (!r) throw new Error(`service ${cfg.service} not offered for this parcel`);
  return r;
}
const tagsOf = (order) => (order.tags || '').split(',').map((s) => s.trim()).filter(Boolean);

async function shipOrder(order) {
  const ref = `Shopify #${order.order_number}`;
  const to = addressFor(order);
  if (to.country_alpha2 !== 'US') throw new Error('international: bring to the counter');
  const parcel = parcelFor(order);
  const { rates, demo } = await petership('rates', { to, parcel });
  const rate = pick(rates);
  if (cfg.dry_run) { log(`${ref}: would ship ${rate.carrier} ${rate.service} $${rate.price}${demo ? ' (demo prices)' : ''}`); return; }
  const { shipment } = await petership('shipments', { to, parcel, rate_id: rate.id, reference: ref, insure: cfg.insure_over_usd > 0 && Number(order.total_price) > cfg.insure_over_usd, email: order.email || undefined });
  // Fulfilment: Shopify wants the fulfillment order ids for this order.
  const { fulfillment_orders } = await shopify(`/orders/${order.id}/fulfillment_orders.json`);
  const open = fulfillment_orders.filter((f) => f.status === 'open' || f.status === 'in_progress');
  if (open.length) {
    await shopify('/fulfillments.json', { method: 'POST', body: JSON.stringify({ fulfillment: {
      line_items_by_fulfillment_order: open.map((f) => ({ fulfillment_order_id: f.id })),
      tracking_info: { number: shipment.tracking_number, company: shipment.carrier, url: shipment.track_url },
      notify_customer: true,
    } }) });
  }
  const tags = tagsOf(order);
  if (!tags.includes(cfg.tag)) await shopify(`/orders/${order.id}.json`, { method: 'PUT', body: JSON.stringify({ order: { id: order.id, tags: [...tags, cfg.tag].join(', ') } }) });
  log(`${ref}: ${shipment.id} ${shipment.carrier} ${shipment.service} ${shipment.tracking_number} $${shipment.total}`);
}

async function pass() {
  const { orders } = await shopify('/orders.json?status=open&financial_status=paid&fulfillment_status=unfulfilled&limit=50');
  const todo = orders.filter((o) => !tagsOf(o).includes(cfg.tag) && !(o.fulfillments ?? []).length);
  log(`${todo.length} order(s) to ship${cfg.dry_run ? ' (dry run)' : ''}`);
  for (const o of todo) {
    try { await shipOrder(o); } catch (e) { log(`Shopify #${o.order_number}: skipped, ${e.message}`); }
  }
}

const me = await petership('me');
log(`PeterShip account: ${me.account.business_name} (${me.account.discount_percent}% off), key ${me.key.label}; shop ${cfg.shop}`);
await pass();
if (!once) setInterval(() => pass().catch((e) => log('pass failed:', e.message)), 5 * 60 * 1000);
