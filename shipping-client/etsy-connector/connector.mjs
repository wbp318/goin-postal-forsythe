#!/usr/bin/env node
// PeterShip Etsy connector v1.69.0 (to-do T28). Pulls a shop's paid, unshipped receipts through the
// Etsy Open API v3, buys labels through the PeterShip public API, and posts the carrier and tracking
// number back to the receipt so Etsy marks it shipped and tells the buyer. Node 24, no packages.
// Same shape as the eBay, Square and Shopify connectors.
//   node connector.mjs --once      one pass
//   node connector.mjs             every 5 minutes
// Config: config.json beside this file (see config.example.json); PETERSHIP_KEY, ETSY_KEYSTRING and
// ETSY_REFRESH_TOKEN may come from the environment. The refresh token comes from Etsy's OAuth consent
// flow once (the README says how). Etsy rotates the refresh token on every use, so the connector keeps
// the latest one in token.json beside the config; the value in the config is only the first.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = process.argv.find((a) => a.endsWith('.json')) ?? join(here, 'config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
for (const k of ['petership_key', 'etsy_keystring', 'etsy_refresh_token']) cfg[k] = process.env[k.toUpperCase()] ?? cfg[k];
cfg.service ??= 'cheapest';
cfg.default_parcel ??= { length_in: 10, width_in: 8, height_in: 4, min_weight_lb: 0.5, weight_per_item_lb: 0.5 };
cfg.notify_buyer ??= true;
const once = process.argv.includes('--once');
const ETSY = 'https://openapi.etsy.com/v3';
const donePath = join(here, 'shipped.json');
const done = new Set(existsSync(donePath) ? JSON.parse(readFileSync(donePath, 'utf8')) : []);
const tokenPath = join(here, 'token.json');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Etsy access tokens last an hour and every refresh hands back a new refresh token (90 days), so the
// newest pair is written to token.json and wins over the config on the next start.
let access = existsSync(tokenPath) ? JSON.parse(readFileSync(tokenPath, 'utf8')) : { token: null, until: 0, refresh: cfg.etsy_refresh_token };
access.refresh ??= cfg.etsy_refresh_token;
async function accessToken() {
  if (access.token && Date.now() < access.until - 60_000) return access.token;
  const res = await fetch(`${ETSY}/public/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: cfg.etsy_keystring, refresh_token: access.refresh }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Etsy token: ${res.status} ${j.error_description ?? j.error ?? ''}`);
  access = { token: j.access_token, until: Date.now() + (Number(j.expires_in) || 3600) * 1000, refresh: j.refresh_token ?? access.refresh };
  writeFileSync(tokenPath, JSON.stringify(access));
  return access.token;
}
async function etsy(path, form) {
  const res = await fetch(`${ETSY}/application${path}`, {
    method: form ? 'POST' : 'GET',
    headers: { 'x-api-key': cfg.etsy_keystring, Authorization: `Bearer ${await accessToken()}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const text = await res.text();
  const j = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Etsy ${path}: ${res.status} ${j.error ?? text.slice(0, 200)}`);
  return j;
}
async function petership(path, body) {
  const res = await fetch(`${cfg.petership_url}/api/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${cfg.petership_key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PeterShip ${path}: ${j.error ?? res.status}`);
  return j;
}

const money = (m) => (m && m.divisor ? Number(m.amount) / Number(m.divisor) : 0);

/** Etsy receipts carry no weight; per-SKU overrides or a default box plus a weight per item. */
function parcelFor(receipt) {
  const d = cfg.default_parcel;
  let weight = 0, dims = null;
  for (const t of receipt.transactions ?? []) {
    const qty = Number(t.quantity) || 1;
    const o = cfg.products?.[t.sku] ?? cfg.products?.[t.title];
    weight += (o?.weight_lb ?? d.weight_per_item_lb ?? 0.5) * qty;
    if (o && !dims) dims = o;
  }
  const box = dims ?? d;
  const total = money(receipt.grandtotal) || money(receipt.subtotal);
  return { length_in: box.length_in, width_in: box.width_in, height_in: box.height_in, weight_lb: Math.max(weight, d.min_weight_lb ?? 0.5, 0.1), value_usd: total || undefined };
}
function addressFor(r) {
  if (!r.first_line || !r.zip) throw new Error('no ship-to address');
  return { name: r.name || 'Customer', line_1: r.first_line, line_2: r.second_line || undefined, city: r.city, state: r.state, postal_code: r.zip, country_alpha2: r.country_iso || 'US', phone: '', email: r.buyer_email || undefined };
}
function pick(rates) {
  if (!rates.length) throw new Error('no rates');
  if (cfg.service === 'cheapest') return [...rates].sort((a, b) => a.price - b.price)[0];
  if (cfg.service === 'fastest') return [...rates].sort((a, b) => (a.max_days ?? 99) - (b.max_days ?? 99) || a.price - b.price)[0];
  const r = rates.find((x) => x.id === cfg.service);
  if (!r) throw new Error(`service ${cfg.service} not offered for this parcel`);
  return r;
}
// Etsy's carrier names for the tracking call (lower case, from its carrier list).
const CARRIER = { USPS: 'usps', UPS: 'ups', FedEx: 'fedex', DHL: 'dhl' };

async function shipReceipt(r) {
  const ref = `Etsy ${r.receipt_id}`;
  const to = addressFor(r);
  if (to.country_alpha2 !== 'US') throw new Error('international: bring to the counter');
  const parcel = parcelFor(r);
  const { rates, demo } = await petership('rates', { to, parcel });
  const rate = pick(rates);
  if (cfg.dry_run) { log(`${ref}: would ship ${rate.carrier} ${rate.service} $${rate.price}${demo ? ' (demo prices)' : ''}`); return; }
  const { shipment } = await petership('shipments', { to, parcel, rate_id: rate.id, reference: ref, insure: cfg.insure_over_usd > 0 && (parcel.value_usd ?? 0) > cfg.insure_over_usd, email: to.email });
  done.add(r.receipt_id); writeFileSync(donePath, JSON.stringify([...done]));
  await etsy(`/shops/${cfg.etsy_shop_id}/receipts/${r.receipt_id}/tracking`, {
    tracking_code: shipment.tracking_number ?? '',
    carrier_name: CARRIER[shipment.carrier] ?? String(shipment.carrier).toLowerCase(),
    send_bcc: cfg.notify_buyer ? 'true' : 'false',
  });
  log(`${ref}: ${shipment.id} ${shipment.carrier} ${shipment.service} ${shipment.tracking_number} $${shipment.total}`);
}

async function pass() {
  const q = new URLSearchParams({ was_paid: 'true', was_shipped: 'false', was_canceled: 'false', limit: '100' });
  const { results = [] } = await etsy(`/shops/${cfg.etsy_shop_id}/receipts?${q}`);
  const todo = results.filter((r) => !done.has(r.receipt_id) && r.status !== 'Canceled' && r.status !== 'Payment Processing');
  log(`${todo.length} receipt(s) to ship${cfg.dry_run ? ' (dry run)' : ''}`);
  for (const r of todo) {
    try { await shipReceipt(r); } catch (e) { log(`Etsy ${r.receipt_id}: skipped, ${e.message}`); }
  }
}

const me = await petership('me');
if (!cfg.etsy_shop_id) {
  const who = await etsy('/users/me');
  if (!who.shop_id) throw new Error('this Etsy user has no shop; set etsy_shop_id');
  cfg.etsy_shop_id = who.shop_id;
}
log(`PeterShip account: ${me.account.business_name} (${me.account.discount_percent}% off), key ${me.key.label}; Etsy shop ${cfg.etsy_shop_id}`);
await pass();
if (!once) setInterval(() => pass().catch((e) => log('pass failed:', e.message)), 5 * 60 * 1000);
