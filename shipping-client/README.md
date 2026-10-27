# PeterShip

PeterShip is the store's own shipping client. A plan for replacing Easyship with software the store owns: rating, labels, tracking, drop-offs and reports for USPS, UPS, FedEx and DHL, built on the same Cloudflare stack as the website. The same thing ShippingEasy, Easyship and GP Rate Pro do, but ours. PeterShip is proprietary, see [LICENSE](LICENSE); it is not under the repository's Apache license.

Item 44 in [`AGENDA.md`](../AGENDA.md) tracks it. Everything that can be built without carrier keys is built and running in mock mode: the rating engine (Phase 2), the print queue and printer agent (Phase 3), tracking, poll, exceptions and customer updates (Phase 4), and drop-off capture and reports (Phase 5). Releases v1.16.0 through v1.20.0, October 21 to 26, 2026. See [What is built so far](#what-is-built-so-far). What remains waits on the owners' carrier accounts (Phase 1).

## What is built so far

Started October 21, 2026. The website now runs on PeterShip's rating engine, with Easyship as one adapter among five, so nothing changes for customers until the direct carriers are switched on.

```mermaid
flowchart LR
  P["/ship page and /api/rates"]:::you --> Q["quote()"]:::local
  Q --> E["engine.getQuotes()<br/>parallel, cache 5 min,<br/>retail rules, sort"]:::local
  E --> U["usps adapter"]:::local
  E --> UP["ups adapter"]:::local
  E --> F["fedex adapter"]:::local
  E --> D["dhl adapter"]:::local
  E --> ES["easyship adapter<br/>fills any carrier<br/>with no keys"]:::local
  U -.->|when keys set| UA["USPS APIs v3"]:::cloud
  UP -.->|when keys set| UPA["UPS REST"]:::cloud
  F -.->|when keys set| FA["FedEx REST"]:::cloud
  D -.->|when keys set| DA["MyDHL API"]:::cloud
  ES --> ESA["Easyship"]:::cloud
  C["/api/compare<br/>PIN, parity test"]:::local --> E
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

| Piece | Where | State |
|---|---|---|
| Shared shapes: Address, Parcel, Rate, Label, TrackingEvent, Provider | `site/src/shipping/types.ts` | Done |
| Billable weight: dimensional divisors per carrier, USPS one-cubic-foot rule, ounce and pound rounding, length-plus-girth oversize check | `site/src/shipping/dim.ts` | Done |
| OAuth client-credentials tokens cached in KV, JSON calls with carrier-tagged errors | `site/src/shipping/http.ts` | Done |
| USPS adapter: OAuth, total-rates search (domestic and international), label with payment authorization, void, tracking | `site/src/shipping/providers/usps.ts` | Written to the published reference, not yet sent to USPS |
| UPS adapter: OAuth, Shop rating with negotiated rates and transit times, ship, void, track | `site/src/shipping/providers/ups.ts` | Same |
| FedEx adapter: OAuth, rate quotes with account rates, ship, cancel, track | `site/src/shipping/providers/fedex.ts` | Same |
| DHL Express adapter: rates, shipments with export declaration, tracking | `site/src/shipping/providers/dhl.ts` | Same |
| Easyship adapter wrapping the existing client | `site/src/shipping/providers/easyship.ts` | Done, carries the site today |
| Rating engine: every configured carrier in parallel, Easyship fills gaps, retail rules, five-minute cache, sorted, errors logged not shown | `site/src/shipping/engine.ts` | Done |
| Label routing by rate id prefix, so Stripe and the counter never know which adapter bought the label | `site/src/shipping/engine.ts`, `site/src/lib/fulfil.ts` | Done |
| Parity endpoint: every provider's rates side by side for one shipment | `POST /api/compare`, staff PIN | Done |
| D1 schema: customers, shipments, tracking events, drop-offs, retail rules, staff, print queue | `site/db/schema.sql` | Applied locally by `npm run db:local`, in production by `npm run db:remote`. Orders stay in KV; shipments are mirrored into D1 |
| Carrier keys and sandbox switches | `site/.dev.vars.example`, `site/wrangler.jsonc` | Done, all blank until issue 12 |
| PeterShip store: shipments, tracking events, print queue, drop-offs in D1, with a memory fallback when no database is bound | `site/src/shipping/store.ts` | Done. Every bought label is recorded here as well as in KV |
| Tracking: `track()` and `voidLabel()` routed by label id prefix, public page at `/track`, `GET /api/track` refreshes from the carrier when events are older than fifteen minutes | `site/src/pages/track/`, `site/src/pages/api/track.ts` | Done in mock mode. Linked from the done page, in all 13 languages |
| Print queue and printer agent: staff tap Print at the counter, a small Node program on the counter PC prints ZPL to a Zebra or a PDF through the OS | `POST /api/print`, [`printer-agent/`](printer-agent/README.md) | Done, untested against a real Zebra ([issue 5](https://github.com/wbp318/goin-postal-forsythe/issues/5)) |
| Drop-off capture: scan a prepaid or return package's barcode, carrier guessed from the number, "carrier picked up" marks the day's hand-over | `/counter/dropoff`, `POST /api/dropoff` | Done |
| Tracking poll: refreshes every open shipment older than fifteen minutes from its carrier adapter. Run by the printer agent every ten minutes while the shop PC is on, by a scheduled GitHub Action every thirty minutes, or by staff on demand | `site/src/shipping/poll.ts`, `POST /api/track-poll`, `.github/workflows/track-poll.yml` | Done in mock mode |
| Exceptions list for staff: carrier exceptions, returns to sender, labels not scanned after three days, no movement for seven days, with Check carriers now | `/counter/exceptions`, `POST /api/exceptions` | Done |
| Reports for staff: shipments, what customers paid, what carriers charged and the margin, by day, carrier and service; busiest hours and weekdays; returning customers; drop-offs by carrier; CSV of every shipment for reconciling the carrier invoice | `/counter/reports`, `POST /api/reports`, `store.report()` | Done. Margin reads zero in mock mode because the fallback adapter reports its price as the cost |
| Customer updates: email through Resend and text through Twilio when a shipment is first scanned, out for delivery, delivered, in trouble or returned. One message per status. Opt-in box and mobile number on the ship form. Staff email on exceptions | `site/src/shipping/notify.ts`, `shipment_contacts` and `notifications` tables | Done, logs instead of sending until the Resend and Twilio keys are set |

Customers see service, price and days only. Cost and the provider that answered stay on the server.

```mermaid
flowchart LR
  F["fulfil()<br/>label bought"]:::local --> KV[("KV order")]:::cloud
  F --> ST["store.recordShipment()"]:::local --> D1[("D1<br/>shipments, tracking_events,<br/>print_queue, dropoffs")]:::cloud
  C["Customer<br/>/track?q=GP-XXXXXX"]:::you --> TA["/api/track"]:::local --> D1
  TA -.->|stale, 15 min| TR["engine.track()<br/>carrier adapter"]:::local
  PL["/api/track-poll<br/>agent every 10 min,<br/>GitHub Action every 30"]:::local --> TR
  PL --> D1
  PL --> NO["notify.ts<br/>Resend email, Twilio text,<br/>once per status"]:::local
  NO --> CU["Customer"]:::you
  EX["Staff tablet<br/>/counter/exceptions"]:::you --> D1
  RP["Staff tablet<br/>/counter/reports<br/>margin, hours, CSV"]:::you --> D1
  K["Staff tablet<br/>/counter/GP-XXXXXX<br/>Print at the counter"]:::you --> PQ["/api/print"]:::local --> D1
  AG["printer-agent/agent.mjs<br/>counter PC, polls"]:::local --> PQ
  AG --> Z["Zebra, ZPL over TCP 9100<br/>or PDF via the OS"]:::local
  DO["Staff tablet<br/>/counter/dropoff<br/>scan barcode"]:::you --> DA["/api/dropoff"]:::local --> D1
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

**Next:** the owners open the four developer accounts (issue 12). The first sandbox call to each carrier will need field adjustments; that is expected and is why the adapters are isolated. Then the parity test. Meanwhile the printer agent can be tried against the shop's thermal printer with `node agent.mjs --test` (issue 5). Customer updates need a Resend account (free) and, for texts, a Twilio number (decision 4 for Rin). Carrier webhooks, customs forms and manifests wait on the keys.

## Why build it

| Reason | What it buys the store |
|---|---|
| No middleman fee | Easyship charges a few cents a label on linked accounts and a cent a quote. Ours charges nothing per label. |
| Own retail pricing | Rate Pro's markup rules live in our file, not in a vendor's screens. Online and counter always agree. |
| Own the data | Every shipment, customer and drop-off in our database, exportable, for the reports in agenda item 36. |
| One screen at the counter | Staff quote, print, capture drop-offs and look up customers in one app instead of Rate Pro plus a browser. |
| Franchise angle | Built once for Forsythe, it could run for other Goin' Postal stores on a per-store basis. GP Brands may or may not allow it; that is a question for them. |

What it does not replace: the Goin' Postal POS. In-person money still runs there. Stripe still takes online cards.

## What it has to do

```mermaid
mindmap
  root((PeterShip))
    Rating
      Four carriers in one call
      Dimensional weight
      Surcharges and zones
      Retail markup rules
      Rate cache
    Labels
      Buy and void
      PDF and ZPL
      QR drop-off codes
      Customs forms
      Manifests and SCAN forms
      Pickup requests
    Tracking
      Carrier webhooks
      Tracking page
      Email and text updates
      Exceptions list for staff
    Counter app
      Quote queue
      Drop-off capture by scan
      Customer lookup and history
      Returns
      Insurance
      Print to label printer
    Reports
      Daily shipments and margin
      Carrier reconciliation
      Returning customers
    Admin
      Carrier accounts and keys
      Markup rules editor
      Staff PINs and roles
```

## How it fits together

```mermaid
flowchart LR
  subgraph FRONT["What people use"]
    W["Website /ship<br/>customers"]:::you
    K["Counter app<br/>staff, tablet"]:::you
  end
  subgraph CORE["PeterShip on Cloudflare Workers"]
    Q["Rating engine<br/>normalize, dim weight,<br/>surcharges, markup"]:::local
    L["Label service<br/>buy, void, PDF/ZPL,<br/>customs, manifests"]:::local
    T["Tracking service<br/>webhooks, polling,<br/>notifications"]:::local
    DB[("D1 database<br/>shipments, customers,<br/>drop-offs, rules")]:::local
    A["Adapters<br/>one per carrier"]:::local
  end
  subgraph CARRIERS["Carrier APIs"]
    U["USPS"]:::cloud
    P["UPS"]:::cloud
    F["FedEx"]:::cloud
    D["DHL Express"]:::cloud
  end
  W --> Q
  K --> Q
  K --> L
  Q --> A
  L --> A
  T --> A
  A --> U
  A --> P
  A --> F
  A --> D
  Q --- DB
  L --- DB
  T --- DB
  L --> PR["Label printer<br/>at the counter"]:::local
  S["Stripe<br/>online cards"]:::cloud --> L
  POS["Goin' Postal POS<br/>in-person money"]:::local -.-> K
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

The website already has the customer side, Stripe, orders in KV, the done page with QR codes, and the counter pages. The shipping client grows out of the `quote()` and `buyLabel()` functions that today call Easyship: each carrier gets an adapter behind the same two functions, and the pages do not change.

## What each carrier needs

| Carrier | Account | API | Approval | Label formats | Notes |
|---|---|---|---|---|---|
| USPS | Business account with an Enterprise Payment System account | USPS APIs (OAuth 2.0): Prices, Labels, Tracking, SCAN forms | Self-serve developer portal, then a payment account for live labels | PDF, ZPL | Web Tools retired January 2026, so only the new APIs are an option. |
| UPS | UPS account number in the store's name | UPS Developer Portal (OAuth 2.0): Rating, Shipping, Tracking, Pickup | Self-serve, production access after a test | PDF, ZPL, GIF | Negotiated rates need the account linked to the app. |
| FedEx | FedEx account number | FedEx Developer Portal REST: Rates, Ship, Track, Pickup | Self-serve, production keys after certification checklist | PDF, ZPL, PNG | Web Services goes maintenance-only July 2026, REST is the target. |
| DHL Express | DHL Express account | MyDHL API: Rates, Shipments, Tracking, Pickups | DHL approves API access per account, slowest of the four | PDF, ZPL | Customs documents are built into the shipment call. |

All four are free to call. Costs are postage only.

## Phases

```mermaid
flowchart TB
  P0["0 · Already built<br/>website, Stripe, orders,<br/>QR, counter pages"]:::local --> P1
  P1["1 · Carrier access<br/>owners open four developer<br/>accounts, sandbox keys<br/>⏸ waiting, issue 12"]:::you --> P2
  P2["2 · Rating engine<br/>engine, five adapters, dim weight,<br/>cache, parity endpoint<br/>✅ built, untested live"]:::local --> P3
  P3["3 · Labels<br/>print queue, printer agent, void ✅<br/>customs, manifests ⏸ keys"]:::local --> P4
  P4["4 · Tracking<br/>page, poll, exceptions,<br/>email and text ✅<br/>webhooks ⏸ keys"]:::local --> P5
  P5["5 · Counter app<br/>drop-offs, reports ✅<br/>queue, customers, returns ⏳"]:::local --> P6
  P6["6 · Switch over<br/>run beside Easyship for<br/>a month, then turn it off"]:::you --> P7
  P7["7 · Later<br/>business accounts, CSV batch,<br/>Shopify and Etsy, multi-store"]:::cloud
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

### Phase 0: already built

Website, 13 languages, Stripe Checkout, orders in KV, done page with QR and pickup code, counter page with PIN, print sheet pattern, the `quote()` and `buyLabel()` seams, and the Rate Pro markup rules file. Everything below plugs into these.

### Phase 1: carrier access (owners, 1 to 3 weeks of waiting)

- [ ] USPS: Business Customer Gateway account, developer portal app, Enterprise Payment System account funded for labels.
- [ ] UPS: developer portal app linked to the store's account number, production access.
- [ ] FedEx: developer portal project linked to the account, pass the certification checklist.
- [ ] DHL Express: request MyDHL API access through the account rep.
- [ ] Confirm with GP Brands that a franchisee may ship outside Rate Pro. Rin said the POS is required for money; this asks whether the quoting system is too.

Nothing can be tested until each one lands. They can be requested in parallel on day one.

### Phase 2: rating engine (2 to 3 weeks)

- [x] One `Rate` model for all carriers, already defined in the site.
- [x] Adapter per carrier that maps our address and parcel to the carrier's request and back. Written to each carrier's published reference; the first sandbox call will need field fixes.
- [x] Dimensional weight per carrier rule and the length-plus-girth oversize check. Surcharges and zones come back inside each carrier's rate response.
- [ ] Retail markup from `ratepro.json`, moved into the database (`retail_rules` table exists) with an editor screen.
- [x] Rate cache keyed on origin, destination ZIP, weight band and dimensions, five-minute TTL.
- [ ] Parity test: 50 real quotes compared against Easyship and against Rate Pro's screen (`POST /api/compare` is ready). Must match Rate Pro to the cent before Phase 6.

### Phase 3: labels (2 to 3 weeks)

- [x] Buy and void per carrier, routed by the label id prefix, with the carrier's own QR drop-off code where it exists (USPS Label Broker, UPS and FedEx QR return codes). Untested live.
- [x] PDF for home printing, ZPL for the counter's thermal printer. The adapters request both.
- [ ] Customs forms for international: CN22, CN23, commercial invoice, built from the item list the customer already types. Waits on keys.
- [ ] End-of-day: USPS SCAN form, UPS and FedEx manifests, pickup requests. Waits on keys.
- [x] Printer agent: [`printer-agent/`](printer-agent/README.md), a small Node program on the counter PC that watches the `print_queue` table, so a staff tap on the tablet prints at the counter. Needs a test on the shop's Zebra (issue 5).

### Phase 4: tracking (1 to 2 weeks)

- [ ] Register carrier webhooks where offered. Waits on keys.
- [x] Poll: `/api/track-poll` from the printer agent every ten minutes and a GitHub Action every thirty, events stored per shipment.
- [x] Tracking page `/track`, same look as the done page, 13 languages, no login.
- [x] Email and text updates: in transit, out for delivery, delivered, exception, returned, once per status. Resend for email, Twilio for text, logged until the keys exist. Opt-in box on the ship form.
- [x] Exceptions list for staff at `/counter/exceptions`: carrier exceptions, returns, never scanned, not moving.

### Phase 5: counter app (3 to 4 weeks)

- [ ] Replaces the counter pages with one staff app on the tablet: PIN login, roles (`staff` table exists). Today the counter pages share one PIN and a staff navigation line.
- [ ] Quote queue: everything customers reserved online, plus walk-ups entered by staff.
- [x] Drop-off capture at `/counter/dropoff`: scan the barcode, carrier guessed from the number, customer name and phone, "carrier picked up" marks the hand-over. Receipt printing not yet.
- [ ] Customer lookup and history, address book, returning customer flag, which feeds the Coupon Counter.
- [ ] Returns: generate return labels for online retailers' customers.
- [ ] Third-party insurance quote and purchase.
- [x] Reports at `/counter/reports`: daily shipments and margin, by carrier and service, busiest hours and days, returning customers, drop-offs, CSV for reconciling the carrier invoice.

### Phase 6: switch over (1 month of running both)

- Website quotes both ways and logs the difference. Staff see both prices at the counter.
- When a month passes with no mismatch complaints, Easyship is turned off and its key deleted.
- Keep the Easyship adapter in the code as a fallback switch.

### Phase 7: later

- Business accounts for local shops and Etsy sellers: monthly invoice, pickup schedule, CSV batch upload. Agenda item 28.
- Shopify, Etsy and eBay order import.
- Multi-store mode: one install, many Goin' Postal locations, each with its own accounts and markup. The franchise conversation.

## Timeline

```mermaid
gantt
  title PeterShip build
  dateFormat YYYY-MM-DD
  axisFormat %b %d
  section Done
    Rating engine and five adapters        :done, d1, 2026-10-21, 1d
    Store tracking print queue dropoffs    :done, d2, 2026-10-26, 1d
    Poll exceptions notifications reports  :done, d3, 2026-10-26, 1d
  section Owners
    Open carrier developer accounts        :a1, 2026-11-03, 21d
    Ask GP Brands about Rate Pro           :a2, 2026-11-03, 14d
    Test printer agent on the Zebra        :a3, 2026-11-03, 7d
  section Build after keys
    Sandbox fixes per carrier              :b1, 2026-11-24, 14d
    Customs forms manifests pickups        :b2, 2026-12-08, 14d
    Carrier webhooks                       :b3, 2026-12-15, 7d
    Parity test against Rate Pro           :b4, 2026-12-22, 14d
    Counter app queue customers returns    :b5, 2027-01-05, 21d
  section Switch
    Run beside Easyship and compare        :c1, 2027-01-26, 30d
    Turn Easyship off                      :milestone, 2027-02-25, 0d
```

The first two months of the original plan were done in two sessions, October 21 and 26, 2026, because none of it needed carrier keys. About three months from carrier access to switch-over now, holiday season excluded from the risky parts. The build weeks assume Claude Code doing most of the typing with one person reviewing; a traditional team would quote two to three times longer.

## What it costs

| Item | Cost |
|---|---|
| Carrier APIs | $0. Postage only. |
| Cloudflare D1 database | $0 on the free plan up to 5 GB and 5 million reads a day; $5 a month Workers Paid if exceeded. |
| Text updates | about $0.01 a message through Twilio or similar. 300 shipments a month with three texts each is about $9. |
| Email updates | $0 with Cloudflare Email Workers; a transactional service like Resend is free to 3,000 a month. |
| Thermal label printer | $0. The shop already has one. The printer agent test against it is issue 5. |
| Barcode scanner for drop-offs | $30 to $80 one time, or the tablet camera. |
| Third-party insurance | per policy, passed to the customer. |
| Saved | Easyship's per-label and per-quote fees, and any Easyship or Rate Pro subscription the store pays today. |

What the store saves against Easyship and Rate Pro, with payback at three volumes, is in [`costs/README.md`](costs/README.md). The plan for selling PeterShip to other pack-and-ship stores, with the market, the incumbents, the features still missing, the features nobody else has, pricing and revenue at 25, 100 and 400 stores, is in [`for-other-stores/README.md`](for-other-stores/README.md). Full site costs are in [`site/costs/README.md`](../site/costs/README.md).

## Risks

- **Approvals.** DHL is slow and sometimes declines small accounts. Start with USPS, UPS and FedEx; DHL can stay on Easyship longer.
- **Carrier API churn.** USPS retired Web Tools in January 2026 and FedEx is retiring Web Services. Adapters isolate this, but each carrier will change something every year.
- **Rate parity.** If the counter and the website disagree by a dollar, customers notice. Phase 2's parity test is the gate.
- **Franchise rules.** GP Brands may require Rate Pro for franchisee shipping. Ask before building Phase 5.
- **Hazmat and restricted goods.** The customer form needs the carrier's hazmat questions before labels go live. Lithium batteries are the common case.
- **Printer plumbing.** Printing from a browser to a thermal printer is the fiddliest part of any shipping client. The printer agent is written and waits for a test on the shop's Zebra (issue 5); until it passes, staff print from the label PDF.
- **Support burden.** Easyship answers "why did my label fail" today. After switch-over, we do.

## Decisions for Rin before Phase 2

1. Which carrier accounts does the store hold in its own name today, and which are through Goin' Postal's master accounts?
2. Is a franchisee allowed to quote and ship outside Rate Pro?
3. Should DHL be in scope for version one, or stay on Easyship?
4. Text updates to customers: yes or no, and from what number?
5. Is the goal Forsythe only, or something other Goin' Postal stores could run?
