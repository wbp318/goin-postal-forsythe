-- PeterShip database (Cloudflare D1). Apply with:
--   npx wrangler d1 create goin-postal
--   npx wrangler d1 execute goin-postal --file db/schema.sql
-- Orders stay in KV for now; these tables are the shipping client's own records.

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  consent_sms INTEGER NOT NULL DEFAULT 0,
  consent_email INTEGER NOT NULL DEFAULT 0,
  signup_code TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,                 -- GP-XXXXXX, same as the order code
  customer_id TEXT REFERENCES customers(id),
  carrier TEXT NOT NULL,               -- USPS, UPS, FedEx, DHL
  service TEXT NOT NULL,
  rate_id TEXT NOT NULL,               -- provider:code that was bought
  provider TEXT NOT NULL,              -- usps, ups, fedex, dhl, easyship
  origin_json TEXT NOT NULL,
  destination_json TEXT NOT NULL,
  parcel_json TEXT NOT NULL,
  billable_weight_lb REAL,
  cost REAL NOT NULL,                  -- carrier charge to the store
  price REAL NOT NULL,                 -- what the customer paid
  tax REAL NOT NULL DEFAULT 0,
  paid_via TEXT,                       -- stripe, pos
  tracking_number TEXT,
  label_id TEXT,
  status TEXT NOT NULL,                -- quoted, paid, labeled, printed, in_transit, delivered, exception, voided
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS shipments_created ON shipments(created_at);

CREATE TABLE IF NOT EXISTS tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id TEXT NOT NULL REFERENCES shipments(id),
  at TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  location TEXT,
  raw_json TEXT
);
CREATE INDEX IF NOT EXISTS tracking_shipment ON tracking_events(shipment_id, at);

CREATE TABLE IF NOT EXISTS dropoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode TEXT NOT NULL,               -- scanned from a prepaid or return label
  carrier TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  accepted_by TEXT,                    -- staff name or PIN id
  accepted_at TEXT NOT NULL,
  handed_to_carrier_at TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS dropoffs_barcode ON dropoffs(barcode);

CREATE TABLE IF NOT EXISTS retail_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,                 -- default, carrier, service
  match TEXT,                          -- carrier or service name
  percent REAL,
  flat REAL,
  price REAL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'counter', -- counter, manager, owner
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS print_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id TEXT REFERENCES shipments(id),
  kind TEXT NOT NULL,                  -- label_zpl, label_pdf, receipt, card_sheet
  payload TEXT NOT NULL,               -- base64 or a URL
  printer TEXT NOT NULL DEFAULT 'counter',
  queued_at TEXT NOT NULL,
  printed_at TEXT
);

-- Who to tell about a shipment, and what they have been told. Kept apart from shipments so the
-- schema stays re-runnable (CREATE IF NOT EXISTS) with no column migrations.
CREATE TABLE IF NOT EXISTS shipment_contacts (
  shipment_id TEXT PRIMARY KEY REFERENCES shipments(id),
  email TEXT,
  phone TEXT,
  sms_opt_in INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_id TEXT NOT NULL REFERENCES shipments(id),
  status TEXT NOT NULL,                -- in_transit, out_for_delivery, delivered, exception, returned
  channels TEXT NOT NULL,              -- email, sms, "email,sms", none
  sent_at TEXT NOT NULL,
  UNIQUE (shipment_id, status)
);

-- The counter queue: one row per quote a customer accepted online or staff typed in for a walk-up,
-- kept in step with the KV order on every save. Orders themselves stay in KV; this is the listable
-- index the staff queue page reads, oldest first.
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,                 -- GP-XXXXXX, same as the order code
  source TEXT NOT NULL,                -- online, counter
  status TEXT NOT NULL,                -- awaiting_payment, reserved, labeled, printed, voided, cancelled
  customer_name TEXT,
  email TEXT,
  phone TEXT,
  carrier TEXT NOT NULL,
  service TEXT NOT NULL,
  price REAL NOT NULL,
  destination TEXT NOT NULL,           -- "Name, City, ST 71201"
  international INTEGER NOT NULL DEFAULT 0,
  staff TEXT,                          -- who typed a walk-up in
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS quotes_status ON quotes(status, created_at);

-- Insurance and packaging add-ons (Phase 5). The catalog the owners edit at /counter/rules, and the
-- lines actually sold, so reports can add them up. kind "setting" rows hold the insurance terms.
CREATE TABLE IF NOT EXISTS addons (
  code TEXT PRIMARY KEY,               -- box-s, pack, signature, or a setting name
  kind TEXT NOT NULL,                  -- box, packing, service, setting
  name TEXT NOT NULL,
  price REAL NOT NULL,                 -- for a setting, the value
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_addons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,              -- GP-XXXXXX
  code TEXT NOT NULL,                  -- an add-on code, or "insurance"
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_addons_order ON order_addons(order_id);
CREATE INDEX IF NOT EXISTS order_addons_created ON order_addons(created_at);
