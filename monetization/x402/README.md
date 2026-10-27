# x402 for Goin' Postal

A plan for letting software pay the store. x402 is the HTTP payment protocol that Coinbase and Cloudflare put under the Linux Foundation in 2026: a server answers a request with `402 Payment Required` and a price, the client pays in USDC on a blockchain, a facilitator checks the payment, and the server answers the request. No account, no API key, no card form. It exists so that AI agents can buy things from websites the way a person does, one request at a time, for amounts as small as a tenth of a cent.

The store already runs on Cloudflare Workers and already exposes the functions an agent would want: a rate quote, a label, a tracking lookup, a business-card render. Gating those behind x402 is a day of work with Cloudflare's template. This page says what to sell, what it costs, what it could earn, and why the honest expectation for 2027 is small money and a head start rather than a new income line.

## How a payment works

```mermaid
sequenceDiagram
  participant A as Agent or app
  participant W as Store Worker on Cloudflare
  participant F as Facilitator (Coinbase CDP)
  participant C as Base or Solana chain
  A->>W: GET /api/rates?to=70601&lb=5
  W-->>A: 402 Payment Required, price $0.01 USDC, pay-to address
  A->>A: Signs a USDC transfer for $0.01
  A->>W: GET /api/rates again with X-PAYMENT header
  W->>F: Verify this payment
  F-->>W: Valid
  W-->>A: 200 OK, the rates
  W->>F: Settle
  F->>C: USDC moves to the store wallet
```

The store never touches a wallet key in the Worker. It holds a receiving address. Coinbase's facilitator verifies for free and charges a tenth of a cent per settlement after the first 1,000 a month. Cloudflare's `x402-proxy` Worker template does the 402 dance per route, with per-route prices, and lets humans through free while charging bots.

## What the store could sell per request

| Endpoint | What the buyer gets | Price in USDC | Who buys it | Exists today |
|---|---|---|---|---|
| **Rate quote** `/api/rates` | Retail prices for USPS, UPS, FedEx and DHL from the Monroe counter, with days | $0.01 | Agents comparing where to ship a parcel from, price-comparison tools, other stores' software | Yes, the ship page calls it |
| **Buy a label** `/api/ship` | A paid label PDF and a pickup code, postage plus the store's margin, for drop at the counter or a scheduled pickup | the label price, say $12 to $60 | A personal AI assistant shipping a return or a gift for its human, a seller's agent | Yes, behind Stripe today |
| **Track** `/api/track` | Carrier events for a tracking number, normalized across four carriers | $0.005 | Agents watching a parcel, apps that do not want four carrier integrations | Yes |
| **Drop-off slot** `/api/dropoff` | A QR code to drop a prepaid parcel at the counter | $0 (free, it brings people in) | Return-processing agents | Yes |
| **Business-card render** `/api/cards/render` | A print-ready PDF from a template and text, or a 300 dpi preview | $0.25 a render, order price to print | Agents designing cards for small businesses, other print shops | The renderer exists, the endpoint is a day |
| **Print and hold** `/api/cards/order` | Cards printed and held at the counter | the card price | Same | Behind Stripe today |
| **Store facts** `/api/store` | Hours, services, prices, holiday closures, in 13 languages | $0.001 | AI assistants answering "where can I ship a box near Forsythe Ave" | The data file exists |
| **Pay per crawl** | Any page of the website, to AI crawlers | $0.01 a page | AI companies training or answering | Cloudflare's crawl control, a toggle |
| **MCP server** | All of the above as tools an agent can discover and call | per tool as above | Agents built on Claude, Bedrock, Cloudflare Agents SDK | A week |

Two of these are the ones that matter. **Buy a label** is real money per call and is the thing a personal assistant will actually be asked to do. **MCP server** is how an agent finds the store in the first place: listed in Coinbase's Agent.market and the x402 Bazaar, the store becomes a tool an agent can call from anywhere.

```mermaid
flowchart LR
  AG["AI agent<br/>a personal assistant,<br/>a seller's bot,<br/>another store's software"]:::you --> MCP["Goin Postal MCP server<br/>quote, ship, track, cards<br/>x402 on every tool"]:::cloud
  MCP --> R["/api/rates $0.01"]:::cloud
  MCP --> S["/api/ship label price"]:::cloud
  MCP --> T["/api/track $0.005"]:::cloud
  MCP --> K["/api/cards/render $0.25"]:::cloud
  S --> PQ["Print queue<br/>label waits at the counter<br/>or pickup scheduled"]:::store
  K --> CQ["Card order<br/>printed and held"]:::store
  R & S & T & K --> USDC["USDC to the store wallet<br/>auto-convert to dollars<br/>at Coinbase"]:::store
  classDef store fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

## What it costs the store to take an x402 payment

Compared with Stripe, which is what the site uses now.

| Payment | Stripe fee | x402 fee | Difference |
|---|---|---|---|
| $0.01 rate quote | not possible, minimum fee is $0.30 | $0.001 | x402 is the only way to charge this |
| $0.25 card render | $0.31, more than the price | $0.001 | same |
| $15 label | $0.735 (2.9% + $0.30) | $0.001 plus about 0% to 1% to turn USDC into dollars | $0.58 to $0.73 saved |
| $40 card order | $1.46 | $0.001 plus conversion | $1.06 to $1.46 saved |
| Refund | Stripe keeps its fee | the store sends USDC back, one settlement fee | no chargebacks either way |

```mermaid
xychart-beta
  title "Fee on one payment, Stripe against x402"
  x-axis ["$0.01 quote", "$0.25 render", "$15 label", "$40 cards"]
  y-axis "Fee in dollars" 0 --> 1.5
  bar [0.30, 0.31, 0.735, 1.46]
  bar [0.001, 0.001, 0.15, 0.40]
```

Tall bars are Stripe. Short bars are x402 with a 1% conversion to dollars assumed on the large payments. The two small payments cannot be taken on Stripe at all.

Running costs: the Cloudflare Worker is already paid for. Coinbase's facilitator is free to 1,000 settlements a month, then $0.001 each. A Coinbase business account for the wallet and conversion is free to open. Nothing else.

## What it could earn

Be honest about this. Agent commerce is new. Coinbase reports 169 million x402 payments in the protocol's first year, but Visa's analysis strips that to about $19 million of real volume and an independent tracker puts real commerce near $28,000 a day across every seller in the world. A pack-and-ship store in Monroe is not going to see a flood of robot customers in 2027.

Three stages, with what each one means.

| Stage | When | What happens | A month |
|---|---|---|---|
| **Switch it on** | 2027 Q1 | Quotes, tracking, store facts and pay-per-crawl behind x402. Listed on Agent.market and the Bazaar. Agents find it, a few dozen calls a day. | $1 to $20 |
| **Labels and cards** | 2027 Q2 | Buy-a-label and card orders through the MCP server. A personal assistant asked "ship this return for me" picks the nearest counter that takes agent payments. Ten labels a month at $15. | $150 to $500 |
| **Network** | 2028, with PeterShip for other stores | Every PeterShip store exposes the same MCP tools. An agent anywhere in the country finds the nearest one. The platform keeps a per-call fee. 100 stores, 20 agent labels each a month, 2% platform fee. | $600 to the platform, $30,000 across stores |

```mermaid
xychart-beta
  title "x402 revenue a month, store and platform"
  x-axis ["Switch on 2027 Q1", "Labels 2027 Q2", "Network 2028"]
  y-axis "Dollars a month" 0 --> 700
  bar [20, 500, 600]
```

These are guesses with wide error bars, not forecasts. The case for doing it anyway is that it costs a day, it saves Stripe fees on every agent payment that would otherwise not happen at all, and the stores that are reachable by agents when agents start shipping parcels will be the ones agents keep using. That is the head start.

## Where x402 fits PeterShip for other stores

The resale plan in [`shipping-client/for-other-stores/README.md`](../../shipping-client/for-other-stores/README.md) bills stores monthly through Stripe. x402 adds three things to it.

| Use | How | Why it is better than the alternative |
|---|---|---|
| **Seller API without onboarding** | A local seller's software calls the store's API and pays per label in USDC. No API key, no $19 plan, no signup. | The monetization plan prices the seller API at $19 a month. With x402 the price is per label and anyone can start in one request. |
| **Store-to-store settlement** | A parcel dropped at one PeterShip store and handed to another: the stores settle the handling fee between themselves in USDC automatically. | No invoices between stores. |
| **Metered platform fee** | Instead of or alongside the $79 plan, a store pays PeterShip a cent per label by x402 as labels are made. | Zero-commitment tier for stores that will not sign a subscription. The facilitator fee is a tenth of a cent on a one-cent payment, so the margin holds. |

## What has to be true first

```mermaid
flowchart TD
  A["Coinbase business account<br/>receiving wallet, USDC to USD<br/>auto-conversion"]:::you --> B["x402-proxy Worker<br/>per-route prices<br/>humans free, bots pay"]:::cloud
  B --> C["Accounting<br/>every settlement to QuickBooks<br/>in dollars at the day's rate<br/>Louisiana sales tax on cards"]:::store
  C --> D["Terms<br/>refund rule for agent purchases<br/>no label until payment settles"]:::store
  D --> E["MCP server<br/>quote, ship, track, cards<br/>listed on Agent.market"]:::cloud
  E --> F["Watch for a quarter<br/>calls a day, revenue,<br/>failed settlements"]:::you
  classDef store fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

| Piece | What it means | Build | Cost |
|---|---|---|---|
| **Wallet and conversion** | A Coinbase business account that receives USDC on Base and Solana and converts to dollars daily into the store's bank. Postage is paid to carriers in dollars, so the store must not sit on USDC. | An afternoon of forms | $0 to open, about 1% to convert |
| **The 402 gate** | Cloudflare's `x402-proxy` template in front of the API routes, with a price table. Logged-in staff and the website's own calls bypass it. | A day | $0 |
| **Settle before you ship** | A label is bought only after the facilitator confirms settlement, not on verify alone. Labels are postage, and postage is not refundable from the carrier. | Half a day | $0 |
| **Books** | Each settlement becomes a sale in dollars at that day's rate, in QuickBooks, with sales tax on taxable items. The accountant must bless the method before the first dollar. | A day plus an hour of the accountant | $0 |
| **Refunds** | A written rule: labels are void-and-refund within 24 hours if unused, cards are not refundable once printed. Refunds go back to the paying address. | An hour | $0 |
| **MCP server** | A Worker exposing the four tools, with x402 on each, a manifest, and a listing on Agent.market and the x402 Bazaar. | A week | $0 |
| **Monitoring** | Count calls, revenue, failed settlements and abuse on the staff reports page. Rate-limit free endpoints. | Half a day | $0 |

About two weeks of build in total, none of it urgent, all of it after the Forsythe switch-over.

## Risks

- **No one comes.** Likely in 2027. The cost of being wrong is a day of work and a Coinbase account.
- **Crypto on the books.** The store receives USDC. Convert daily and record in dollars; the accountant decides the method. Louisiana does not tax postage, does tax printed cards. Never hold a balance.
- **Volatility.** USDC is a dollar stablecoin, so price risk is near zero, but Circle's reserves are the counterparty. Daily conversion keeps exposure to one day's sales.
- **Fraud and abuse.** An agent can hammer a free endpoint. Rate-limit by IP and by payer address, keep the free ones cheap to serve. Paid endpoints are self-limiting.
- **Postage is final.** A label bought by a confused agent is postage spent. Settle first, allow void within 24 hours, and show the agent the full price and the drop-off terms before the 402.
- **Franchise rules.** Taking payment in a new way may touch the Goin' Postal agreement. Same conversation with GP Brands as everything else (issue 11).
- **Protocol churn.** x402 v2 shipped in December 2025 and Cloudflare proposed a deferred-settlement scheme. Pin the template version, update quarterly.
- **Reputation.** Some customers hear "crypto" and think scam. Nothing on the public site changes; this is machine-to-machine only. Humans keep paying by card.

## Decisions for Rin

1. Open a Coinbase business account in the store's name, or wait until PeterShip has its own LLC and open it there.
2. Agree the refund rule for agent-bought labels and cards.
3. Have the accountant approve recording USDC sales in dollars with daily conversion.
4. Pick the prices: a cent a quote, half a cent a track, a quarter a render, or something else.

## Sources

- Protocol and foundation: [x402 Foundation under the Linux Foundation, members including Coinbase, Cloudflare, AWS, Anthropic and Circle](https://blockeden.xyz/blog/2026/03/05/x402-foundation-ai-payment-internet/); [Cloudflare's launch post and deferred payment scheme](https://blog.cloudflare.com/x402); [x402 explained](https://sherlock.xyz/post/x402-explained-the-http-402-payment-protocol).
- Facilitator fees: [Coinbase Developer Platform, free to 1,000 settlements a month then $0.001](https://x.com/CoinbaseDev/status/1995564027951665551); [CDP FAQ, no processor or chargeback fees](https://docs.cdp.coinbase.com/x402/support/faq); [facilitator comparison including thirdweb 0.3% and Stripe preview 1.5%](https://wavect.io/blog/x402-payments-comparison-2026/); [networks supported](https://stablecoininsider.org/how-to-choose-an-x402-facilitator-for-usdc/).
- Cloudflare implementation: [x402-proxy Worker template](https://developers.cloudflare.com/ai-crawl-control/reference/worker-templates); [template update with per-route pricing](https://ppc.land/cloudflare-updates-x402-template-as-micropayments-gain-traction/); [a site charging a penny a page and watching Claude pay it](https://suganthan.com/blog/x402-pay-per-crawl/); [Stack Overflow and Cloudflare pay-per-crawl](https://stackoverflow.blog/2026/02/19/stack-overflow-cloudflare-pay-per-crawl/); [Cloudflare and AWS at the edge](https://www.infoq.com/news/2026/07/cloudflare-aws-x402-micropayment/).
- Adoption and the honest numbers: [Chainalysis on 100 million agentic payments on Base](https://www.chainalysis.com/blog/x402-agentic-payments-adoption/); [200 million payments, half may be fake](https://startupfortune.com/ai-agents-have-moved-over-200-million-payments-on-x402-but-half-may-be-fake/); [adoption tracker, about $28,000 a day of real commerce](https://presenc.ai/research/x402-protocol-adoption-tracker-2026); [named production deployments](https://majormatters.co/x402).
- Internal: [monetization plan](../README.md), [PeterShip for other stores](../../shipping-client/for-other-stores/README.md), [site costs](../../site/costs/README.md).
