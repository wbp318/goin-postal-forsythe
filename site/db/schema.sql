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

-- Who did what. One row per staff action: buy, print, void, cancel, email, drop-off, price change,
-- staff change. staff_id is null for the shared PINs; staff_name is always filled.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  staff_id INTEGER,
  staff_name TEXT NOT NULL,
  action TEXT NOT NULL,                -- label.buy, label.void, dropoff.accept, rules.save, staff.add, ...
  target TEXT,                         -- GP code, receipt number, staff id
  detail TEXT
);
CREATE INDEX IF NOT EXISTS audit_at ON audit_log(at);
CREATE INDEX IF NOT EXISTS audit_staff ON audit_log(staff_id, at);

-- Carrier invoice audits: one row per invoice checked, one per billed tracking number.
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carrier TEXT NOT NULL,
  label TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  line_count INTEGER NOT NULL,
  billed_total REAL NOT NULL,
  expected_total REAL NOT NULL,
  flagged_total REAL NOT NULL           -- overcharges plus voided and duplicate lines
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  tracking TEXT NOT NULL,
  shipment_id TEXT,
  carrier TEXT,
  service TEXT,
  billed REAL NOT NULL,
  expected REAL,
  variance REAL,
  status TEXT NOT NULL,                 -- match, over, under, unknown, voided, duplicate
  description TEXT,
  line_date TEXT,
  disputed INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
CREATE INDEX IF NOT EXISTS invoice_lines_invoice ON invoice_lines(invoice_id, status);

-- End-of-day closes: the frozen figures for a day, with who closed it and their note.
CREATE TABLE IF NOT EXISTS day_closes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,                   -- YYYY-MM-DD, shop local
  closed_at TEXT NOT NULL,
  closed_by TEXT NOT NULL,
  note TEXT,
  pos_expected REAL NOT NULL,
  stripe_expected REAL NOT NULL,
  labels INTEGER NOT NULL,
  report_json TEXT NOT NULL,
  zpl TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS day_closes_day ON day_closes(day);

-- Business accounts (agenda item 28, PeterShip T1): a discount and monthly billing on top of a customer.
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id),
  business_name TEXT NOT NULL,
  discount_percent REAL NOT NULL DEFAULT 0,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS account_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  period TEXT NOT NULL,                -- YYYY-MM
  issued_at TEXT NOT NULL,
  total REAL NOT NULL,
  lines_json TEXT NOT NULL,            -- the shipments billed
  stripe_invoice_id TEXT,
  stripe_invoice_url TEXT,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS account_statements_account ON account_statements(account_id, period);
-- Which statement a bill-to-account shipment landed on. Kept apart from shipments (no column migrations).
CREATE TABLE IF NOT EXISTS shipment_billing (
  shipment_id TEXT PRIMARY KEY REFERENCES shipments(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  statement_id INTEGER REFERENCES account_statements(id)
);
CREATE INDEX IF NOT EXISTS shipment_billing_account ON shipment_billing(account_id, statement_id);

-- Free-text notes on a customer or an order ("always wants signature", "fragile pottery"), with who wrote them.
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                  -- customer, order
  target TEXT NOT NULL,                -- customer id or GP code
  note TEXT NOT NULL,
  by_name TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_target ON notes(kind, target, id);

-- Print jobs the agent gave up on (printer off, out of labels, PDF unreachable). Left out of the
-- queue until staff press Retry on the queue page, which deletes the row.
CREATE TABLE IF NOT EXISTS print_failures (
  job_id INTEGER PRIMARY KEY REFERENCES print_queue(id),
  error TEXT,
  tries INTEGER NOT NULL DEFAULT 0,
  at TEXT NOT NULL
);

-- API keys for business accounts (the public API under /api/v1). The key itself is shown once and kept hashed.
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  label TEXT NOT NULL,                 -- "Shopify", "warehouse laptop"
  prefix TEXT NOT NULL,                -- first characters, to tell keys apart on the page
  key_hash TEXT NOT NULL UNIQUE,
  webhook_url TEXT,
  webhook_secret TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS api_keys_account ON api_keys(account_id, active);

-- x402: payments software made per request in USDC (monetization/x402). One row per settled payment.
CREATE TABLE IF NOT EXISTS x402_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  endpoint TEXT NOT NULL,              -- store, rates, track, shipments
  amount_usd REAL NOT NULL,
  payer TEXT,                          -- the paying wallet address
  network TEXT,
  tx_hash TEXT,
  facilitator TEXT,
  status TEXT NOT NULL DEFAULT 'settled', -- settled, refund_owed, refunded
  note TEXT,
  shipment_id TEXT
);
CREATE INDEX IF NOT EXISTS x402_payments_at ON x402_payments(at);
CREATE INDEX IF NOT EXISTS x402_payments_tx ON x402_payments(tx_hash);

-- Returns drop-off (agenda item 27): a customer says online that they are bringing a return. Served
-- from /counter/dropoff, which records the drop-off and marks the request served.
CREATE TABLE IF NOT EXISTS return_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           -- RT-XXXXXX, on the customer's QR
  created_at TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  carrier TEXT,                        -- Amazon, UPS, FedEx, USPS, DHL
  label TEXT NOT NULL DEFAULT 'printed', -- printed, print (we print it, paid), qr (carrier prints from a QR)
  box INTEGER NOT NULL DEFAULT 0,      -- 1 when they need a box (paid)
  tracking TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open, served
  served_at TEXT,
  dropoff_id INTEGER REFERENCES dropoffs(id)
);
CREATE INDEX IF NOT EXISTS return_requests_status ON return_requests(status, created_at);

-- Mailbox subscriptions (agenda items 24, 29): paid on Stripe in subscription mode from /mailbox; the
-- box number and PS Form 1583 are recorded at /counter/mailbox/CODE.
CREATE TABLE IF NOT EXISTS mailboxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           -- MB-XXXXXX
  created_at TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  business_name TEXT,
  size TEXT NOT NULL,                  -- small, medium, large
  term TEXT NOT NULL,                  -- monthly, yearly
  price REAL NOT NULL,                 -- per term, at signup
  status TEXT NOT NULL DEFAULT 'awaiting_payment', -- awaiting_payment, active, past_due, cancelled
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_session_id TEXT,
  started_at TEXT,
  current_period_end TEXT,
  cancelled_at TEXT,
  box_number TEXT,
  form_1583_at TEXT,
  form_1583_by TEXT,
  ids_seen TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS mailboxes_status ON mailboxes(status, created_at);
CREATE INDEX IF NOT EXISTS mailboxes_sub ON mailboxes(stripe_subscription_id);

-- Mailbox mail notifications (to-do T12): one row each time staff tell a holder something arrived.
CREATE TABLE IF NOT EXISTS mailbox_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_code TEXT NOT NULL REFERENCES mailboxes(code),
  kind TEXT NOT NULL,                  -- mail, package, other
  note TEXT,
  by_name TEXT NOT NULL,
  at TEXT NOT NULL,
  texted INTEGER NOT NULL DEFAULT 0,
  emailed INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS mailbox_notices_box ON mailbox_notices(mailbox_code, at);

-- Claims (to-do T13): a package lost, damaged or short. open -> filed -> approved/denied -> refunded -> closed.
CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           -- CL-XXXXXX
  shipment_id TEXT NOT NULL REFERENCES shipments(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  kind TEXT NOT NULL,                  -- lost, damaged, missing_contents
  carrier TEXT NOT NULL,
  tracking_number TEXT,
  declared_usd REAL NOT NULL DEFAULT 0,
  postage_usd REAL NOT NULL DEFAULT 0,
  claimed_usd REAL NOT NULL DEFAULT 0,
  insured INTEGER NOT NULL DEFAULT 0,  -- 1 when the customer bought our insurance
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open, filed, approved, denied, refunded, closed
  carrier_claim_number TEXT,
  filed_at TEXT,
  decided_at TEXT,
  carrier_paid_usd REAL,
  customer_refund_usd REAL,
  refund_via TEXT,                     -- pos, stripe, account_credit, check
  refunded_at TEXT,
  customer_notified_at TEXT,
  closed_at TEXT,
  notes TEXT,
  by_name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS claims_status ON claims(status, filed_at);

-- Pickups for business accounts (to-do T15): scheduled -> on_the_way -> picked_up, or missed / cancelled.
CREATE TABLE IF NOT EXISTS pickups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           -- PU-XXXXXX
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  account_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,        -- YYYY-MM-DD
  window TEXT NOT NULL DEFAULT 'morning', -- morning, afternoon
  address_json TEXT NOT NULL,
  phone TEXT,
  packages INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  fee_usd REAL NOT NULL DEFAULT 0,     -- the catalog's pickup item at scheduling time
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, on_the_way, picked_up, missed, cancelled
  driver TEXT,
  on_the_way_at TEXT,
  texted_at TEXT,
  picked_up_at TEXT,
  by_name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pickups_day ON pickups(scheduled_date, window);
CREATE INDEX IF NOT EXISTS pickups_account ON pickups(account_id, scheduled_date);

-- Intake photos (to-do T17): the item before packing. Bytes live in the ORDERS KV namespace under photo:<id>.
CREATE TABLE IF NOT EXISTS shipment_photos (
  id TEXT PRIMARY KEY,                 -- 32 random hex characters, also the KV key
  shipment_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  caption TEXT,
  by_name TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shipment_photos_shipment ON shipment_photos(shipment_id, at);

-- Customer accounts online (to-do T20): saved addresses. Login tokens live in KV, sessions in a signed cookie.
CREATE TABLE IF NOT EXISTS customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  label TEXT NOT NULL,
  address_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_addresses_customer ON customer_addresses(customer_id);

-- Merchant returns portal (to-do T22): a public link per business account; its customers make prepaid return labels billed to the account.
CREATE TABLE IF NOT EXISTS return_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  token TEXT NOT NULL UNIQUE,          -- 24 hex characters, in the URL /return/<token>
  return_to_json TEXT NOT NULL,        -- where the packages go: the merchant, or the store
  service TEXT,                        -- a service name to force, or NULL for cheapest
  max_weight_lb REAL NOT NULL DEFAULT 10,
  note TEXT,                           -- shown to the customer and put in the email
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS return_links_account ON return_links(account_id);

-- Pirate Ship benchmark log (to-do T26): one row per quote where the benchmark applied, for the weekly share at or under it.
CREATE TABLE IF NOT EXISTS benchmark_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  source TEXT NOT NULL,                -- online, counter, batch, api
  zone INTEGER NOT NULL,
  weight_lb REAL NOT NULL,
  store_price REAL,                    -- the store's cheapest USPS ground price, NULL when USPS gave no rate
  benchmark REAL NOT NULL,             -- Pirate Ship's estimate
  at_or_under INTEGER NOT NULL         -- 1 when store_price <= benchmark
);
CREATE INDEX IF NOT EXISTS benchmark_log_at ON benchmark_log(at);
