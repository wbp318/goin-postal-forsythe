# Changelog

Every release of the Goin' Postal Forsythe repository, newest first, rebuilt from the GitHub releases by `python scripts/changelog.py`. Each release page carries the full notes and, from v1.63.0 on, a file-by-file changelog with links. The agenda's log in [AGENDA.md](AGENDA.md) tells the same story by date with the item numbers.

## [v1.67.0] - 2026-10-29

**low-stock alerts and label resend from the account page**

To-do **T31** ([AGENDA.md](https://github.com/wbp318/goin-postal-forsythe/blob/v1.67.0/AGENDA.md)): two small conveniences that follow from fulfillment (v1.63.0) and customer accounts (v1.55.0).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.67.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.67.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.66.0...v1.67.0)

## [v1.66.0] - 2026-10-29

**eBay connector**

To-do **T28** ([AGENDA.md](https://github.com/wbp318/goin-postal-forsythe/blob/v1.66.0/AGENDA.md)), step 3 of the [connectors plan](https://github.com/wbp318/goin-postal-forsythe/blob/v1.66.0/shipping-client/connectors/README.md): the eBay connector, [shipping-client/ebay-connector/](https://github.com/wbp318/goin-postal-forsythe/tree/v1.66.0/shipping-client/ebay-connector). The third connector after [Shopify](https://github.com/wbp318/goin-postal-forsythe/tree/v1.66.0/shipping-client/shopify-connector) and [Square](https://github.com/wbp318/goin-postal-forsythe/tree/v1.66.0/shipping-client/square-connector), same shape, Node 24, no packages.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.66.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.66.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.65.0...v1.66.0)

## [v1.65.0] - 2026-10-29

**seller dashboard on the account page**

To-do **T30** ([AGENDA.md](https://github.com/wbp318/goin-postal-forsythe/blob/v1.65.0/AGENDA.md)): the seller dashboard. Everything the counter keeps for a business account, visible to the account's own contact when they sign in on `/account`.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.65.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.65.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.64.3...v1.65.0)

## [v1.64.3] - 2026-10-29

**CHANGELOG.md**

At the owners' request: a changelog file in the repository.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.64.3) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.64.3) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.64.2...v1.64.3)

## [v1.64.2] - 2026-10-29

**release notes with a full changelog**

At the owners' request ("releases must be more in detail and have links to what was fixed"), every release now ends with a changelog that links what changed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.64.2) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.64.2) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.64.1...v1.64.2)

## [v1.64.1] - 2026-10-29

**selling PeterShip to Goin' Postal, the plan**

Agenda **item 59** ([AGENDA.md](https://github.com/wbp318/goin-postal-forsythe/blob/v1.64.1/AGENDA.md)), at the owners' request: the plan to sell PeterShip to Goin' Postal Franchise Corporation (GP Brands) as the replacement for GP Rate Pro, the way it would be sold to an Auctane. [shipping-client/gp-brands/README.md](https://github.com/wbp318/goin-postal-forsythe/blob/v1.64.1/shipping-client/gp-brands/README.md).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.64.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.64.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.64.0...v1.64.1)

## [v1.64.0] - 2026-10-29

**Square connector**

To-do **T28** ([AGENDA.md](https://github.com/wbp318/goin-postal-forsythe/blob/v1.64.0/AGENDA.md)), the first live marketplace connector after Shopify, step 2 of the [connectors plan](https://github.com/wbp318/goin-postal-forsythe/blob/v1.64.0/shipping-client/connectors/README.md): [shipping-client/square-connector/](https://github.com/wbp318/goin-postal-forsythe/tree/v1.64.0/shipping-client/square-connector).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.64.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.64.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.63.0...v1.64.0)

## [v1.63.0] - 2026-10-29

**fulfillment at the store, the ShipBob shape at Monroe scale**

To-do **T29**, the fulfillment half of agenda item 58 ([AGENDA.md, item 58 and T29](https://github.com/wbp318/goin-postal-forsythe/blob/v1.63.0/AGENDA.md), plan in [shipping-client/connectors/README.md](https://github.com/wbp318/goin-postal-forsythe/blob/v1.63.0/shipping-client/connectors/README.md)). A business account keeps stock on the store's shelf; its orders come in; the store picks, packs and ships them on its rates; the fees go on the account's statement. The ShipBob shape at Monroe scale, with no minimum and no onboarding fee.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.63.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.63.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.62.1...v1.63.0)

## [v1.62.1] - 2026-10-29

**marketplace connectors and fulfillment, the plan, plus eBay, Amazon, Square and WooCommerce imports**

Agenda item 58, at the owners' request: [shipping-client/connectors/README.md](https://github.com/wbp318/goin-postal-forsythe/blob/main/shipping-client/connectors/README.md).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.62.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.62.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.62.0...v1.62.1)

## [v1.62.0] - 2026-10-29

**card print routing, Sent to the printer**

To-do T27, the software half of item 56 (who prints the business cards). On the counter card page: a **Print it** line with the printer the chart suggests and why (standard stock up to 250 in the shop; any upsell or 500 and up to the trade printer unless rushed; rushed non-standard to Sir Speedy), a printer select with that suggestion picked, a field for the printer's order number, and **Sent to the printer**, which puts the order in a new `sent` status until **Cards arrived, mark printed**. The queue therefore shows what is out of the building. The print sheet gained **Front SVG** and **Back SVG** downloads named by the order code, for a trade printer's upload form (print to PDF from the sheet still works). 1 new test; `astro check`, Vitest and the build pass. Verified on the dev server: a 500-card linen order suggested the trade printer, was sent as 4over with a reference, showed it on the page, and was marked printed on arrival.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.62.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.62.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.61.0...v1.62.0)

## [v1.61.0] - 2026-10-29

**the Pirate Ship benchmark on every quote**

To-do T26, step 6 of the rates-below-Pirate-Ship plan (item 54): the measurement.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.61.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.61.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.60.0...v1.61.0)

## [v1.60.0] - 2026-10-29

**OpenAPI spec and a developers page for the public API**

To-do T25. The public API now has a machine-readable description and a page people can read.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.60.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.60.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.59.0...v1.60.0)

## [v1.59.0] - 2026-10-29

**the numbers a buyer asks for, on the reports page**

To-do T24. The reports page already had shipments, what customers paid, what carriers charged and the margin by day, carrier and service. Under it there is now **The numbers a buyer asks for**, for the same date range:

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.59.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.59.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.58.0...v1.59.0)

## [v1.58.0] - 2026-10-29

**a store switcher on the counter pages**

To-do T23, the multi-store second form, in the shape that fits one deployment per store: a **store switcher**. A store's facts can list its `siblings` (id, name, url); when they are set, every `/counter/` page shows a store select in the header, and picking another store opens the same counter page on that store's deployment, where that store's PIN applies. `scripts/new-store.py` now writes the new store's siblings pointing at Forsythe and prints the line to add to Forsythe's. Customer pages never show it.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.58.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.58.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.57.0...v1.58.0)

## [v1.57.0] - 2026-10-29

**merchant returns portal, a return link per business account**

Merchant returns portal, to-do T22. The returns flow turned around: a business account's own customers make their prepaid return labels from a link, and the labels go on the account's statement. The Loop Returns and ShipStation returns feature at a store's scale.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.57.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.57.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.56.1...v1.57.0)

## [v1.56.1] - 2026-10-29

**PeterShip LLC, the plan and the draft papers**

Agenda item 57, at the owners' request: [shipping-client/llc/](https://github.com/wbp318/goin-postal-forsythe/tree/main/shipping-client/llc). **Drafts by the site's AI assistant, not a lawyer; a Louisiana attorney reads them before anyone signs.**

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.56.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.56.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.56.0...v1.56.1)

## [v1.56.0] - 2026-10-29

**the delivered email asks for a Google review**

To-do T21. Every shipment with an email already received the in-transit, out-for-delivery and delivered emails from the tracking poll, free, not only the paid text add-on. The delivered email now ends with a Google review ask once the store's review link is set in the store facts (`reviewUrl`, from the Google Business Profile, issue 7; blank sends no ask) and a line nudging the customer to ship online next time or ask about a mailbox. Serves agenda item 25 (the review card). 1 new test, 94 in total; `astro check`, Vitest and the build pass.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.56.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.56.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.55.1...v1.56.0)

## [v1.55.1] - 2026-10-29

**who prints the business cards, the plan**

Agenda item 56, at the owners' request: [monetization/business-cards/README.md](https://github.com/wbp318/goin-postal-forsythe/blob/main/monetization/business-cards/README.md).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.55.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.55.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.55.0...v1.55.1)

## [v1.55.0] - 2026-10-29

**customer accounts online, magic link, saved addresses, order history**

Customer accounts online, to-do T20. Repeat online orders in two clicks.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.55.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.55.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.54.0...v1.55.0)

## [v1.54.0] - 2026-10-29

**cash drawer and tips in the end-of-day close**

Cash drawer and tips in the close, to-do T18. The number the owners look at every night.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.54.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.54.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.53.1...v1.54.0)

## [v1.53.1] - 2026-10-29

**screen-printed shirts through a partner, the plan**

A new revenue line at the owners' request, agenda item 55: [monetization/screen-printing/README.md](https://github.com/wbp318/goin-postal-forsythe/blob/main/monetization/screen-printing/README.md).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.53.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.53.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.53.0...v1.53.1)

## [v1.53.0] - 2026-10-29

**intake photos before packing, on the order and claim pages**

Package intake photos, to-do T17.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.53.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.53.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.52.0...v1.53.0)

## [v1.52.0] - 2026-10-29

**pickup scheduling for accounts, with the driver's route and On the way texts**

Pickup scheduling for business accounts, to-do T15. The offer page says "ask about scheduled pickup"; now there is something to schedule.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.52.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.52.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.51.0...v1.52.0)

## [v1.51.0] - 2026-10-29

**claims, from open to refunded, with a thirty-day flag**

Claims, to-do T13: what happens when a package is lost, damaged or arrives short. The thing that bites the first month real labels go out, now a page instead of a sticky note.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.51.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.51.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.50.0...v1.51.0)

## [v1.50.0] - 2026-10-29

**mailbox mail notifications, Mail in and Package in**

Mailbox mail notifications, to-do T12: the promise printed on `/mailbox`, "a text or email when mail or a package arrives," now has a button.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.50.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.50.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.49.1...v1.50.0)

## [v1.49.1] - 2026-10-29

**rates below Pirate Ship, the plan**

The plan for quoting under Pirate Ship, written at the owners' request: [shipping-client/rates/README.md](https://github.com/wbp318/goin-postal-forsythe/blob/main/shipping-client/rates/README.md).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.49.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.49.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.49.0...v1.49.1)

## [v1.49.0] - 2026-10-29

**batch shipping, CSV in, labels out, billed to the account**

Batch shipping, to-do T11: a business account's whole stack of orders as one file, every row checked and priced, labels bought in one click and printed in order. The feature Pirate Ship and ShipStation lead with, now in PeterShip for the counter and for the account's own software.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.49.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.49.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.48.0...v1.49.0)

## [v1.48.0] - 2026-10-29

**business-accounts one-page offer (closes the revenue batch)**

The small-business accounts one-page offer, agenda item 28 and the last of the tabled revenue batch. The software side has existed since v1.32.0 (accounts, discount, bill to account, monthly statement with a Stripe invoice); this is the page that gets a shop owner to say yes.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.48.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.48.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.47.0...v1.48.0)

## [v1.47.0] - 2026-10-29

**mailbox subscriptions online, box number at the counter after Form 1583**

Mailbox subscriptions sold online, the online half of agenda items 24 and 29 and the fourth of the tabled revenue batch. The recurring line in the monetization plan: a box paid every month or year without a card swipe at the counter.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.47.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.47.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.46.0...v1.47.0)

## [v1.46.0] - 2026-10-29

**returns drop-off form and the counter's returns-coming-in list**

Returns drop-off form, the online half of agenda item 27 and the third of the tabled revenue batch. People who have never shipped anything bring Amazon and UPS returns in; the money is the label print, the box and whatever they notice while they are here.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.46.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.46.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.45.0...v1.46.0)

## [v1.45.0] - 2026-10-29

**sales tax on online orders (cards, boxes, packing)**

Sales tax on online orders (agenda item 50), the second of the tabled revenue batch. Needed before the first real card order.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.45.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.45.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.44.0...v1.45.0)

## [v1.44.0] - 2026-10-29

**card designer upsells (stock, finish, rounded corners, rush)**

Card designer upsells: paper stock, finish, rounded corners and rush pickup, priced on the server. First of the tabled revenue batch from the monetization plan (agenda item 45).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.44.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.44.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.43.2...v1.44.0)

## [v1.43.2] - 2026-10-29

**v1.43.2 Vice City RP plan: GTA 6 only**

Docs only. The Vice City roleplay plan is now a GTA 6 project with no GTA V or FiveM version. GTA 6 has no PC release or server platform yet, so the plan lists what gets built now without one: the design document, the counter and packing game as a browser prototype on the store site using the real rating engine, the PeterShip bridge with a single money table and kill switch, assets in neutral formats, a Discord and waiting list, and the paperwork with GP Brands and a lawyer. The rumored real-money creator economy in GTA 6 is designed for from the start so backing the in-game dollar with real money is a configuration change: creator payouts on parcels, wages with a cash-out path, real goods shipped from the game through the public API, mailbox rent as revenue, with age gates and no pay-to-win in the roleplay. Timeline separates our dates from Rockstar's unknown ones. Costs, risks and Rin's decisions updated; the root README and monetization overview match.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.43.2) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.43.2) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.43.1...v1.43.2)

## [v1.43.1] - 2026-10-29

**v1.43.1 Vice City RP plan: the rumored GTA 6 real-money economy**

Docs only. monetization/vice-city-rp/README.md gains a section on the rumored real-money creator economy in GTA 6: what is rumored and by whom, what it would turn the in-game shipping company into (creator payouts on parcels, wages with a cash-out path, real goods shipped from the game through PeterShip, mailbox rent as real revenue), what it would take (Rockstar's program terms, tax, age rules, GP Brands on the name), and the rule that the GTA V server stays in-game dollars only until Rockstar opens a program. A risk row and a fourth decision for Rin added; the root README line updated.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.43.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.43.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.43.0...v1.43.1)

## [v1.43.0] - 2026-10-29

**v1.43.0 Online convenience fee and text updates add-on (item 45)**

Two of the monetization plan's fast wins switched on: the online convenience fee and a paid text-updates line. Agenda item 45.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.43.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.43.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.42.0...v1.43.0)

## [v1.42.0] - 2026-10-29

**v1.42.0 x402 gate: agents pay the store per request (item 53)**

The x402 gate: software and AI agents can pay the store per request in USDC, with no account, no key and no card form. Agenda item 53, the first of the October 26 revenue plans turned into code. The plan with prices, money and the Kraken/facilitator split is `monetization/x402/README.md`; this release adds its "What is built" section.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.42.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.42.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.41.0...v1.42.0)

## [v1.41.0] - 2026-10-28

**v1.41.0 PeterShip: full data export (T10)**

PeterShip: full data export, to-do item T10, the last item in the T1 to T10 table. Everything the store keeps, in open formats, on demand, so no store is ever locked in and a buyer's diligence, an accountant or the next system gets the real records rather than a report of them.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.41.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.41.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.40.0...v1.41.0)

## [v1.40.0] - 2026-10-28

**v1.40.0 PeterShip: public API, signed webhooks, Shopify connector (T9)**

PeterShip: the public API and a Shopify connector, to-do item T9. A business account's own software can now quote, buy and void labels through the store and get tracking pushed back, with every label billed to the account at its discount. This is the piece a buyer like Auctane or Shopify looks for first.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.40.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.40.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.39.0...v1.40.0)

## [v1.39.0] - 2026-10-28

**v1.39.0 PeterShip: multi-store, first form**

PeterShip: multi-store, first form, to-do item T8. One codebase, one deployment per store, each with its own facts, storage and secrets. This is what the West Carroll store or the first other Goin' Postal would use today.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.39.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.39.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.38.1...v1.39.0)

## [v1.38.1] - 2026-10-28

**v1.38.1 PeterShip: automated test suite**

PeterShip: the automated test suite, to-do item T7. With the type-check and build already in CI, every push now has to pass 46 tests as well.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.38.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.38.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.37.0...v1.38.1)

## [v1.37.0] - 2026-10-28

**v1.37.0 PeterShip: offline resilience, counter PC plan**

PeterShip: offline resilience, to-do item T6, for the days the shop's internet drops. Also the counter PC plan the owners asked for, and the CI code job moved to Node 24.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.37.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.37.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.36.0...v1.37.0)

## [v1.36.0] - 2026-10-28

**v1.36.0 PeterShip: printer agent hardening, CI code checks**

PeterShip: printer agent hardening, to-do item T5, and a CI job that checks every line of code on every push, asked for by the owners. Mock mode, no carrier keys needed; the printer itself is still untested against a real Zebra (issue 5).

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.36.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.36.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.35.0...v1.36.0)

## [v1.35.0] - 2026-10-28

**v1.35.0 PeterShip: address validation**

PeterShip: address validation, to-do item T4. Mock mode, no carrier keys needed; the carriers' own address services connect later.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.35.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.35.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.34.0...v1.35.0)

## [v1.34.0] - 2026-10-28

**v1.34.0 PeterShip: notes and reasons**

PeterShip: notes and reasons, to-do item T3. Mock mode, no carrier keys needed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.34.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.34.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.33.0...v1.34.0)

## [v1.33.0] - 2026-10-28

**v1.33.0 PeterShip: packing advisor**

PeterShip: the packing advisor, to-do item T2. Mock mode, no carrier keys needed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.33.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.33.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.32.0...v1.33.0)

## [v1.32.0] - 2026-10-28

**v1.32.0 PeterShip: business accounts**

PeterShip: business accounts, the first item of the to-do table (T1) and the software half of agenda item 28. Mock mode, no carrier keys needed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.32.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.32.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.31.0...v1.32.0)

## [v1.31.0] - 2026-10-28

**v1.31.0 PeterShip: end-of-day close and Z-report**

PeterShip: the end-of-day close, item N11, the third of the three the owners asked for after the counter app was finished. Mock mode, no carrier keys needed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.31.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.31.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.30.0...v1.31.0)

## [v1.30.0] - 2026-10-28

**v1.30.0 PeterShip: carrier invoice audit**

PeterShip: the carrier invoice audit, item N10, the second of the three the owners asked for. Mock mode, no carrier keys needed; real invoices arrive once the carrier accounts exist.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.30.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.30.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.29.0...v1.30.0)

## [v1.29.0] - 2026-10-28

**v1.29.0 PeterShip: staff logins and audit log**

PeterShip: staff logins and the audit log, item N9. The first of the three the owners asked for next (staff logins, carrier invoice audit, end-of-day close). Mock mode, no carrier keys needed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.29.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.29.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.28.1...v1.29.0)

## [v1.28.1] - 2026-10-28

**v1.28.1 PeterShip: insurance and packaging add-ons**

PeterShip Phase 5: insurance and packaging add-ons, item N6, the last piece of the counter app that needs no carrier keys. Mock mode throughout.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.28.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.28.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.28.0...v1.28.1)

## [v1.28.0] - 2026-10-28

**v1.28.0 (misplaced tag, see v1.28.1)**

This tag landed on the previous commit by mistake while the release was being cut; it does not contain the insurance and add-ons work. Use v1.28.1, which is the real release of that work with the full notes.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.28.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.28.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.27.0...v1.28.0)

## [v1.27.0] - 2026-10-28

**v1.27.0 Staff pages in 14 languages, Quebec French, the goals**

Staff pages in every language, Quebec French everywhere, the goals written down, and a few owner requests. Item N7 in the agenda.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.27.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.27.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.26.0...v1.27.0)

## [v1.26.0] - 2026-10-28

**v1.26.0 PeterShip: returns at the counter, Email label**

PeterShip Phase 5: returns at the counter, item N5. Mock mode, no carrier keys needed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.26.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.26.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.25.0...v1.26.0)

## [v1.25.0] - 2026-10-28

**v1.25.0 PeterShip: drop-off receipts**

PeterShip Phase 5: drop-off receipts, item N4 and the last row of the first next-up table. Mock mode, no carrier keys needed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.25.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.25.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.24.1...v1.25.0)

## [v1.24.1] - 2026-10-28

**v1.24.1 PeterShip: price rules editor, chart legends, void guidance**

PeterShip Phase 5 continues: the price rules editor, item N3 in the agenda's next-up table, plus three documentation requests from the owners. v1.24.0 carries the code; v1.24.1 adds the documentation and is the release to read. Mock mode, no carrier keys needed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.24.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.24.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.23.0...v1.24.1)

## [v1.23.0] - 2026-10-28

**v1.23.0 PeterShip: customer lookup, ship again, and the long guide**

PeterShip Phase 5 continues: customer lookup, item N2 in the agenda's next-up table, plus a long plain-language guide in the PeterShip README for the owners. Mock mode, no carrier keys needed, like everything so far.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.23.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.23.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.22.0...v1.23.0)

## [v1.22.0] - 2026-10-28

**v1.22.0 PeterShip: counter quote queue, walk-ups, void and cancel**

PeterShip Phase 5 continues: the counter quote queue, item N1 in the agenda's next-up table. Everything runs in mock mode with no carrier keys, like the rest of PeterShip.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.22.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.22.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.21.3...v1.22.0)

## [v1.21.3] - 2026-10-27

**v1.21.3 Savings page: shop already owns the thermal printer**

Rin confirmed on October 26, 2026 that the shop already has a 4x6 thermal label printer. `shipping-client/costs/README.md` is updated to match. No code changes.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.21.3) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.21.3) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.21.2...v1.21.3)

## [v1.21.2] - 2026-10-27

**v1.21.2 x402 plan: Kraken for the wallet, PayAI or self-hosted facilitator**

The x402 plan in `monetization/x402/README.md` now uses Kraken instead of Coinbase for the store's money. No code changes.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.21.2) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.21.2) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.21.1...v1.21.2)

## [v1.21.1] - 2026-10-27

**v1.21.1 Plan: Vice City shipping company on a GTA roleplay server**

A side idea written down as a plan: `monetization/vice-city-rp/README.md`. No code changes.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.21.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.21.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.21.0...v1.21.1)

## [v1.21.0] - 2026-10-27

**v1.21.0 Plans: PeterShip savings, selling to other stores, x402 payments**

Three planning documents for PeterShip and the store's business model, every chart rendered with mermaid-cli 11 and covered by the Mermaid CI check. No code changes.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.21.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.21.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.20.2...v1.21.0)

## [v1.20.2] - 2026-10-26

**agenda next-up table, quote queue first**

Agenda-only release. The agenda now says what gets built next, and the log is caught up through v1.20.1. No code changed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.20.2) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.20.2) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.20.1...v1.20.2)

## [v1.20.1] - 2026-10-26

**docs and licenses caught up with PeterShip v1.17 to v1.20**

Documentation and license catch-up for everything PeterShip shipped in v1.17.0 through v1.20.0. No code behavior changed.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.20.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.20.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.20.0...v1.20.1)

## [v1.20.0] - 2026-10-26

**v1.20.0 PeterShip: daily shipments and margin report**

The first PeterShip report, from Phase 5 of the plan. Staff can see what shipped, what customers paid, what the carriers charged and what the shop kept, without leaving the tablet. Agenda items 44e and, in spirit, 36 and 15 for the shipping side.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.20.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.20.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.19.0...v1.20.0)

## [v1.19.0] - 2026-10-26

**v1.19.0 PeterShip: customer email and text updates**

PeterShip Phase 4 is now complete except for carrier webhooks, which wait on the carrier keys (issue 12). Customers can be told what is happening to their package without asking. Agenda item 44d.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.19.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.19.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.18.0...v1.19.0)

## [v1.18.0] - 2026-10-26

**v1.18.0 PeterShip: tracking poll and exceptions list**

PeterShip Phase 4 continues: tracking now refreshes itself, and staff get a list of what needs a human. Runs in mock mode until the carrier keys from issue 12 arrive. Agenda item 44d.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.18.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.18.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.17.0...v1.18.0)

## [v1.17.0] - 2026-10-26

**v1.17.0 PeterShip: tracking, print queue, drop-offs**

PeterShip grows past the rating engine. Everything here runs in mock mode today and switches to real carriers when the keys from issue 12 arrive. Agenda items 44c, 44d and 44e.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.17.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.17.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.16.1...v1.17.0)

## [v1.16.1] - 2026-10-22

**the shipping client is named PeterShip**

The store's own shipping client, started in v1.16.0, now has its name. PeterShip appears on the plan page (`shipping-client/README.md`), agenda item 44, the root README section and repo map, the site README, the monetization plan, the chart titles, the code comments in the rating engine and shared types, the database schema, the config example, and issue 12.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.16.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.16.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.16.0...v1.16.1)

## [v1.16.0] - 2026-10-22

**shipping client started, rating engine and four carrier adapters**

Phase 2 of the plan in shipping-client/README.md. The website now runs on the shipping client's own rating engine, with Easyship as one adapter among five, so nothing changes for customers until the direct carriers are switched on.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.16.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.16.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.15.1...v1.16.0)

## [v1.15.1] - 2026-10-22

**step-by-step local setup at the top of the README**

The top section of the README is now a full six-step walkthrough for someone who has never run a website locally.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.15.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.15.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.15.0...v1.15.1)

## [v1.15.0] - 2026-10-22

**Cloudflare monetization plan**

Every way the store can earn from what it runs on Cloudflare, ranked by effort against money in a quadrant chart.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.15.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.15.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.14.0...v1.15.0)

## [v1.14.0] - 2026-10-22

**agenda for our own shipping client**

The plan to replace Easyship with software the store owns, doing what ShippingEasy, Easyship and GP Rate Pro do.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.14.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.14.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.13.0...v1.14.0)

## [v1.13.0] - 2026-10-22

**prices match the counter, vendor hidden from customers**

Decision: stay with the single Easyship rates call rather than four separate carrier keys.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.13.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.13.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.12.1...v1.13.0)

## [v1.12.1] - 2026-10-22

**high contrast on by default**

High contrast mode is now on for every first visit: black on white, strong borders, blue links. Visitors can turn it off with the header switch and that choice is remembered on their device. Text size still defaults to A+.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.12.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.12.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.12.0...v1.12.1)

## [v1.12.0] - 2026-10-22

**easier to read for older customers**

The layout is reworked for older eyes and less steady hands. Nothing was removed; every feature is where it was.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.12.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.12.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.11.0...v1.12.0)

## [v1.11.0] - 2026-10-22

**what the website costs**

Every service the site touches, what it charges, and what a month adds up to.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.11.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.11.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.10.1...v1.11.0)

## [v1.10.1] - 2026-10-22

**official store address everywhere**

The official address replaces the intersection placeholder in: the store data file (display address and the Easyship ship-from address), the Google Maps embed on the home page, the footer and page descriptions, the sample business card, the home page lead in all 13 languages, both READMEs, the agenda, and the GitHub repo description.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.10.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.10.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.10.0...v1.10.1)

## [v1.10.0] - 2026-10-22

**the whole site in 13 languages**

A language picker in the header switches every customer page. The choice is remembered on the device, and a first visit follows the browser's language.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.10.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.10.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.9.1...v1.10.0)

## [v1.9.1] - 2026-10-22

**card gallery always shows first**

The editor saves the design in the browser so a refresh does not lose it. On a later visit it jumped straight into that saved design and skipped step 1. Now the gallery always shows first, with a banner offering **Continue it** or **Discard it** when a design is in progress on that device.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.9.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.9.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.9.0...v1.9.1)

## [v1.9.0] - 2026-10-21

**Vistaprint-style business card editor, 12 layouts, 12 colors**

The card designer is rebuilt as a real editor. Instead of a form beside a preview, the customer works directly on the card the way Vistaprint does.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.9.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.9.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.8.1...v1.9.0)

## [v1.8.1] - 2026-10-21

**business cards are paid at creation**

Card orders now go through Stripe Checkout the moment the customer presses Pay and order. There is no pay-at-pickup option. Nothing is printed until Stripe confirms payment.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.8.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.8.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.8.0...v1.8.1)

## [v1.8.0] - 2026-10-21

**business card designer built into the website**

Customers design their own business cards at `/cards`, see them live, download a free PNG, or order 100 to 1000 for pickup and pay on the Goin' Postal POS when they collect. No Vistaprint, no Canva, no outside design service. The logo never leaves the site.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.8.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.8.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.7.0...v1.8.0)

## [v1.7.0] - 2026-10-21

**ship from the website with Easyship, Stripe online, POS in shop**

Customers can now quote USPS, UPS, FedEx and DHL on the site, buy a domestic label by card, and either print it at home or show a QR code and have the shop print it. International shipments are reserved online and paid at the counter.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.7.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.7.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.6.0...v1.7.0)

## [v1.6.0] - 2026-10-21

**store website scaffolded with Astro, no PHP**

A serious PHP exploit was disclosed on October 21, 2026, so the store website is built with Astro instead. Astro compiles to static HTML, CSS and a little JavaScript. There is no server-side code in the site, so there is nothing to patch after launch.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.6.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.6.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.5.0...v1.6.0)

## [v1.5.0] - 2026-10-19

**owner to-do list in the agenda**

Everything the repo can do on its own is done through v1.4.1. What remains is held up by six things only the owners can supply, now listed in `AGENDA.md` under "To do: things only the owners can supply", with a chart showing what each one unlocks.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.5.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.5.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.4.1...v1.5.0)

## [v1.4.1] - 2026-10-19

**owner guard works under python -I**

Running any script with `python -I` (isolated mode, which drops the script's own folder from the import path) failed with `ModuleNotFoundError: No module named 'owner_guard'` before the guard could run. CI uses plain `python`, so the build never showed it.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.4.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.4.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.4.0...v1.4.1)

## [v1.4.0] - 2026-10-19

**One research file per state, 23 states with no Goin' Postal**

Research date October 18, 2026. Adds 23 folders under `research/`, one per state with no Goin' Postal today: alaska, arkansas, colorado, connecticut, delaware, hawaii, idaho, illinois, iowa, kansas, maryland, massachusetts, montana, nebraska, new-hampshire, new-mexico, new-york, oklahoma, rhode-island, south-dakota, vermont, virginia, wyoming.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.4.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.4.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.3.0...v1.4.0)

## [v1.3.0] - 2026-10-18

**Owner check on every script and page**

Clones that have not been set up by an owner now stop with a message instead of working.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.3.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.3.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.2.0...v1.3.0)

## [v1.2.0] - 2026-10-18

**Stronger licensing (Apache 2.0 code, CC BY-NC-ND 4.0 designs and research)**

Replaces the MIT license from v1.1.1 with a two-part license.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.2.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.2.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.1.1...v1.2.0)

## [v1.1.1] - 2026-10-18

**License**

Adds an MIT LICENSE naming the copyright holders Peter Ho and Rin Ho (Ouachita Parish, Louisiana) and William Parker (East Carroll Parish, Louisiana). A trailer states what the license does not cover: the Goin' Postal name and logo (trademarks of GP Brands, Inc.), school and team names, figures quoted from cited sources in the research folder, and customer data, which never enters the repo. The README's public-repo note now links to the license.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.1.1) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.1.1) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.1.0...v1.1.1)

## [v1.1.0] - 2026-10-18

**Round 3 store improvements (14 new agenda items), public repo**

Ideas for the Forsythe store itself, not just its ads. Each can start this season with what is already in the repo.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.1.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.1.0) · [compare](https://github.com/wbp318/goin-postal-forsythe/compare/v1.0.0...v1.1.0)

## [v1.0.0] - 2026-10-18

**Next-store site research (Florida focus + 49 states)**

Research date October 18, 2026. This release adds a `research/` folder with three write-ups, 11 new Mermaid charts, a research section at the root README, and a CI hook that renders every chart in `research/`.

[release](https://github.com/wbp318/goin-postal-forsythe/releases/tag/v1.0.0) · [tree](https://github.com/wbp318/goin-postal-forsythe/tree/v1.0.0)
