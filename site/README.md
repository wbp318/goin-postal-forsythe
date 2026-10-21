# site

The public website for Goin' Postal Forsythe, built with [Astro](https://astro.build) and deployed to Cloudflare. The marketing pages are plain static HTML. The shipping flow runs as a handful of Cloudflare functions. PHP is deliberately not used anywhere.

Rates and payments are separate systems that never talk to each other. Easyship quotes and buys labels through the store's existing account. Online, Stripe takes the card. In the shop, the Goin' Postal POS takes the card or cash, as it must, and staff press one button on the counter page to say so. The site is the only thing in between, so any side can be swapped without touching the others.

```mermaid
flowchart LR
  C["Customer"] -->|address, weight, size| S["/ship page"]
  S -->|POST /api/rates| R["Easyship rates<br/>USPS · UPS · FedEx · DHL"]
  R --> S
  S -->|pick a rate, POST /api/orders| O{"Domestic?"}
  O -->|yes| P["Stripe Checkout<br/>online card"]
  P -->|webhook paid| L["Easyship buys label"]
  O -->|no, international| RES["Reserved"]
  L --> D["/ship/done<br/>PDF label + QR code + pickup code"]
  RES --> D
  D -->|scan QR or type code| K["/counter/CODE<br/>staff page, PIN"]
  K -->|international| POS["Goin' Postal POS<br/>in-person card or cash"]
  POS -->|staff press Rung up| L
  K -->|print| PR["Shop printer"]
  KV[("Cloudflare KV<br/>orders, 90 days")] --- O
  KV --- K
```

## Pages and routes

| Route | Who | What |
|---|---|---|
| `/` | customers | Hero, services, hours, map |
| `/ship` | customers | Quote form, rate list, pay or reserve |
| `/ship/done?order=CODE` | customers | Label download, QR code, pickup code |
| `/cards` | customers | Business card designer: three layouts, palettes, logo upload, live preview, PNG download, pay by card on Stripe and pick up in the shop |
| `/cards/done?order=CODE` | customers | Order confirmation with a QR code and pickup code |
| `/contact` | customers | Formspree contact form |
| `/counter/card/CODE` | staff | Card order, already paid online: preview both sides, print sheet, mark printed, mark picked up. Unpaid orders are flagged do not print |
| `/counter/card/CODE/sheet` | staff | Print-ready 10-up US letter sheet, fronts then mirrored backs |
| `/counter/CODE` | staff | Order details. For international: ring up on the POS, then press the button to buy the label. Mark printed. Needs the PIN |
| `POST /api/rates` | site | Re-quotes through Easyship, filtered to the four carriers |
| `POST /api/orders` | site | Re-quotes server side so prices cannot be edited, then Stripe or reserve |
| `POST /api/stripe-webhook` | Stripe | `checkout.session.completed` buys the label for a `GP-` order or marks a `CD-` card order paid |
| `POST /api/counter` | staff page | `paid` and `printed` actions |
| `GET /api/mock-paid` | dev only | Stands in for Stripe when no key is set |
| `POST /api/cards` | site | Saves a card order (design sanitized server side, logo must be a PNG, JPG or SVG data URL under 400 KB) and starts Stripe Checkout |
| `PUT /api/cards` | staff page | `printed` and `picked_up` actions, PIN |

## Business card designer

Everything runs in the browser. `src/lib/cards.ts` draws the card as SVG from a plain design object, and the same function renders the live preview, the saved order, and the counter's print sheet, so what the customer sees is exactly what prints. Cards are 3.5 by 2 inches at 300 dpi with a dashed safe-area guide. No outside design service is involved and the logo never leaves the site.

```mermaid
flowchart LR
  F["Form: layout, palette,<br/>details, logo"] --> D["design object"]
  D --> P["renderCard()<br/>SVG, 1050 x 600"]
  P --> V["Live preview"]
  P --> PNG["Download PNG<br/>canvas in the browser"]
  D -->|POST /api/cards| KV[("KV card:CODE<br/>180 days")]
  KV --> ST["Stripe Checkout<br/>pay now"]
  ST -->|webhook paid| KV
  KV --> DONE["/cards/done<br/>QR + pickup code"]
  KV --> K["/counter/card/CODE"]
  K --> SH["/sheet: 10 up letter,<br/>fronts then mirrored backs"]
  K --> PU["Picked up"]
```

Prices per quantity are in `PRICES` in `src/lib/cards.ts` and are placeholders until the owners confirm them.

## Run it

```
cd site
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

With `.dev.vars` left blank the site runs in mock mode: fake rates, fake label, Stripe skipped. Orders live in memory until restart. Fill in `EASYSHIP_TOKEN` with a `sand_` token to hit Easyship's sandbox, and the Stripe test keys to use real Checkout.

## Before launch

1. `src/data/store.ts`: street number, ZIP, phone, hours, Formspree ID, and the `origin` ship-from address.
2. Easyship: dashboard, APIs & Webhooks, Create API Connection, API version 2024-09, scopes `public.rate:read`, `public.shipment:write`, `public.label:write`. Use the `prod_` token in production.
3. Stripe: live secret key, and a webhook for `checkout.session.completed` pointed at `/api/stripe-webhook`. Paste its signing secret.
4. Cloudflare: `npx wrangler kv namespace create ORDERS`, paste the id into `wrangler.jsonc`, set `SITE_URL` to the real domain, then `npx wrangler secret put` for `EASYSHIP_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `COUNTER_PIN`.
5. Set the counter tablet or phone to open `/counter/` links from the camera, so scanning a customer's QR opens the order.

## Deploy

Connect the GitHub repo to Cloudflare Workers with root directory `site` and build command `npm run build`. The adapter writes `dist/` with the static pages and the worker.
