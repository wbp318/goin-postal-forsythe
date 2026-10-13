# goin-postal-forsythe

[![CI](https://github.com/wbp318/goin-postal-forsythe/actions/workflows/ci.yml/badge.svg)](https://github.com/wbp318/goin-postal-forsythe/actions/workflows/ci.yml)

Marketing kit for the Goin' Postal store at **Forsythe Ave & N 18th St, Monroe, Louisiana** (Ouachita Parish), owned by Rin Ho and Peter Ho.

The store is open. This repo covers getting its name in front of local families:

- Sponsorship ads for **Monroe Moccasins** hockey games at the Monroe Civic Center
- Banners, program ads and scoreboard spots for **Neville High** and other nearby high schools
- **Billboard** costs for the Monroe market, with an interactive calculator
- Flowcharts for producing, approving and measuring every ad

> **Brand note:** Goin' Postal owns its name and logo. Every design here has a dashed **OFFICIAL LOGO** slot. Drop in the logo file from corporate and get each ad through corporate's brand review before printing. Team and school names appear as text only. No team or school logos or mascots are used.

## Live pages

| Page | What it's for | Link |
|---|---|---|
| **Coupon Counter** | Redeem codes once per customer, see cost per customer and returning customers, and keep the shared ad calendar | [Open Coupon Counter](https://claude.ai/artifact/1yb2fzWW61nSKtMiaUhNH6) |
| **Marketing plan** | Flowcharts, sponsorship costs, billboard calculator | [Open the plan](https://claude.ai/artifact/8uW684TKgZYJ8CwDmX1CmJ) |

What's being worked on, and what's done, is in **[AGENDA.md](AGENDA.md)**.

Both pages are private. They open only for people the owner has shared them with, signed in to claude.ai. Share the Coupon Counter as **Contributor** with everyone who works the counter.

## Marketing at a glance

```mermaid
mindmap
  root((Forsythe store))
    Hockey
      Rink board MOCS10
      Promo night
      103 Rocks radio
    High schools
      Neville fence banner
      Program ad TIGERS10
      Neville Jr High NJH10
      St. Frederick STFRED10
      Scoreboard spot
    Roadside
      Poster billboard
      Digital holiday board
    In the store
      Counter flyer
      Coupon Counter
    Online
      Game day posts
      Sponsor badge
```

## A customer's path

```mermaid
journey
  title From the stands to the counter
  section See the ad
    Sees MOCS10 on the rink board: 4: Customer
    Passes the billboard on the drive home: 3: Customer
  section Visit
    Walks in at Forsythe and N 18th: 4: Customer
    Gives code, name and phone: 3: Customer, Staff
  section Redeem
    Coupon Counter checks one use: 5: Staff
    Package packed and shipped: 5: Customer, Staff
  section Come back
    Returns for holiday shipping: 4: Customer
```

Faces show how smooth each step feels (5 is best). The two flat faces mark small friction points: a billboard is a quick glance from the road, and some customers hesitate to give a phone number. Staff can help by explaining that the number is how the store keeps each code to one use.

## What's in the repo

```mermaid
flowchart LR
  R["goin-postal-forsythe/"] --> A["launch-book.html<br/>marketing plan, flowcharts,<br/>billboard calculator"]
  R --> B["ad-concepts.html<br/>first-round concept sheet"]
  R --> CC["coupon-counter.html<br/>redeem, results, ad calendar"]
  R --> BK["brand-kit.html<br/>colors, fonts, layout rules"]
  R --> AG["AGENDA.md<br/>what's done and what's next"]
  R --> DOC["docs/promo-night-kit.md<br/>PA scripts and checklist"]
  R --> D["designs/"]
  R --> G[".gitattributes<br/>shows every language on GitHub"]
  D --> D0["index.html<br/>gallery of all designs"]
  D --> D1["moccasins-dasher-board.svg"]
  D --> D2["neville-fence-banner.svg"]
  D --> D3["program-ad-half-page.svg"]
  D --> D4["billboard-poster.svg"]
  D --> D5["digital-billboard.svg"]
  D --> D6["sponsor-badge.svg"]
  D --> D7["game-day-social.svg"]
  D --> D8["scoreboard-spot.svg"]
  D --> D9["counter-flyer.svg"]
  D --> D10["school ads:<br/>neville-jr-high-*, st-frederick-*"]
  D --> D11["holiday-deadlines.svg"]
  D --> GD["game-day/<br/>one post per home game"]
  D --> PN["promo-night/<br/>handout, table sign, post"]
  D --> P["png/<br/>one PNG per design,<br/>for WhatsApp and texts"]
  D --> F["pdf/counter-flyer.pdf<br/>print-ready"]
  R --> S["scripts/<br/>export and checks"]
  R --> W[".github/workflows/ci.yml"]
```

## Sharing and printing

Each design comes in three formats:

| Format | Folder | Use it for |
|---|---|---|
| **PNG** | `designs/png/` | WhatsApp, texts, email, Facebook, Instagram |
| **PDF** | `designs/pdf/` | Printing the counter flyer (8.5 × 11 in, fonts embedded) |
| **SVG** | `designs/` | The editable source for a designer, sign shop or printer |

Windows opens `.svg` files in the web browser, and WhatsApp won't send them as pictures. Send the PNG instead.

After changing an SVG, rebuild the PNGs and the PDF (needs Chrome or Edge and an internet connection for the fonts):

```
python scripts/export_designs.py
```

## CI

Every push runs [GitHub Actions](.github/workflows/ci.yml):

```mermaid
flowchart LR
  A["Push to main"] --> B["Check designs<br/>valid SVG, logo slot,<br/>no phone or prices,<br/>PNG and PDF up to date"]
  A --> C["Render every Mermaid chart<br/>in README and plan page"]
  B --> D["Export PNG and PDF<br/>with Chrome"]
  D --> E["Download from the<br/>run's Artifacts"]
  C --> E
```

Run the same check locally with `python scripts/check_designs.py`.

## Designs

| File | Where it runs | Size |
|---|---|---|
| `designs/moccasins-dasher-board.svg` | Moccasins rink board | 8:1 panel |
| `designs/neville-fence-banner.svg` | Neville stadium fence | 8 ft × 3 ft vinyl |
| `designs/program-ad-half-page.svg` | Any school's game program | 7.5 × 5 in |
| `designs/billboard-poster.svg` | Static poster billboard | 22'8" × 10'5" |
| `designs/digital-billboard.svg` | Digital bulletin slot | 14 × 48 ft |
| `designs/sponsor-badge.svg` | Social posts, programs, scoreboards | Square |
| `designs/game-day-social.svg` | Instagram / Facebook | 1080 × 1350 |
| `designs/scoreboard-spot.svg` | Football LED video board | 16:9 |
| `designs/counter-flyer.svg` | Store counter handout, with a directions QR | 8.5 × 11 in |
| `designs/neville-jr-high-fence-banner.svg` | Neville Junior High fence | 8 ft × 3 ft vinyl |
| `designs/neville-jr-high-program-ad.svg` | Neville Junior High program or flyer, code NJH10 | 7.5 × 5 in |
| `designs/st-frederick-fence-banner.svg` | St. Frederick fence | 8 ft × 3 ft vinyl |
| `designs/st-frederick-program-ad.svg` | St. Frederick football program, code STFRED10 | 7.5 × 5 in |
| `designs/holiday-deadlines.svg` | Counter sign: 2026 ship-by dates (USPS, FedEx; UPS write-in) | 8.5 × 11 in |
| `designs/game-day/` | One ready-to-post game-day image per Moccasins home game | 1080 × 1350 |
| `designs/promo-night/` | Promo night handout, table sign and social post (kit: `docs/promo-night-kit.md`) | Various |

The program ads and counter flyer carry a QR code that opens the store's corner in Google Maps. To change the link, edit `MAP_URL` in `scripts/add_qr.py` and run it (`pip install segno` first).

To add game-day posts, add a line to the `GAMES` list at the top of `scripts/make_game_posts.py` and run it. The Oct 30 and 31 opponents are still unconfirmed, so those posts say "Moccasins home game".

Printers, sign shops and designers should start with **[brand-kit.html](brand-kit.html)**: colors, fonts, layout rules and file formats.

Confirm the exact size with each team, school or sign company before final art. Every venue has its own specs.

## Getting an ad made

```mermaid
flowchart TD
  A["Pick the venue and placement"] --> B["Get size and deadline<br/>from the team or booster club"]
  B --> C["Drop the official logo into<br/>the matching design"]
  C --> D["Add the venue coupon code<br/>MOCS10 or TIGERS10"]
  D --> E["Send to corporate<br/>for brand review"]
  E --> F{"Approved?"}
  F -- "Changes requested" --> C
  F -- "Yes" --> G["Send print-ready file<br/>to the printer or venue"]
  G --> H["Proof check: spelling,<br/>address, code"]
  H --> I["Installed or aired"]
  I --> J["Photo for social media<br/>and records"]
```

## Choosing sponsorships

```mermaid
flowchart LR
  A["Pick a venue"] --> B{"Who is in the seats?"}
  B -- "Families from all of Monroe" --> C["Moccasins hockey<br/>Monroe Civic Center"]
  B -- "Parents and neighbors<br/>near the store" --> D["High school athletics"]
  C --> C1["Call the team's<br/>corporate partnerships office"]
  D --> D1["Call the athletic director<br/>or booster club"]
  C1 --> E["Dasher board, PA read,<br/>promo night"]
  D1 --> F["Fence banner, program ad,<br/>scoreboard spot"]
  E --> G["Corporate brand review"]
  F --> G
  G --> H["Print and install"]
  H --> I["Ask every new customer<br/>how they heard of you"]
  I --> J{"Did it bring customers?"}
  J -- "Yes" --> K["Renew next season"]
  J -- "No" --> A
```

| Venue | Placement | Typical cost (est.) |
|---|---|---|
| Monroe Moccasins | Dasher board, one season | $1,500–$4,000 |
| Monroe Moccasins | Sponsored promo night | $500–$1,500 |
| Neville Tigers (0.6 mi) | Stadium fence banner, one year | $500–$1,000 |
| Neville Tigers | Game-day program ad | $100–$400 |
| Neville Junior High (0.4 mi) | Fence banner, program or flyer | No published rates. Ask the Tiger Foundation (njhtigerfoundation@gmail.com) or the school office, and check school board sign rules first |
| St. Frederick (2.0 mi) | Football program ad | Prices on the school's agreement page. The 2026 program closed May 22; 2027 sales open Feb 1, 2027 (sfhsfootballprogram@stfrederickhigh.org) |
| St. Frederick (2.0 mi) | Track sponsorship (2025 packet) | $500 (announcements, social, program) or $1,000 (adds event signage). Contact jwier@stfrederickhigh.org |
| West Monroe, Carroll, Wossman (1.8–3.3 mi) | Fence banner or program ad, each | $150–$1,000 |

These ranges are estimates, not quotes. None of these teams publish prices. For comparison, C.E. Byrd in Shreveport charges $1,000 a season for a football banner. Moccasins sponsorships go through the [partner inquiry form](https://www.moccasinshockey.com/sponsors), and 103 Rocks (103.1 FM) carries every game on the radio.

Where each option lands on cost and local reach (rough judgment from the estimates above, not measured data):

```mermaid
quadrantChart
  title Cost vs reach near the store
  x-axis Low cost --> High cost
  y-axis Low local reach --> High local reach
  quadrant-1 Big bets
  quadrant-2 Best value
  quadrant-3 Fill-ins
  quadrant-4 Rethink
  Neville program ad: [0.12, 0.55]
  Neville fence banner: [0.25, 0.72]
  Other school banners: [0.2, 0.4]
  Neville Jr High banner: [0.15, 0.62]
  St Fred track sponsor: [0.22, 0.5]
  Moccasins promo night: [0.35, 0.78]
  Moccasins rink board: [0.5, 0.86]
  Junior poster billboard: [0.42, 0.45]
  Digital holiday burst: [0.68, 0.62]
  Poster billboard 6 months: [0.78, 0.8]
```

## Billboards

Estimated monthly rates in Monroe (billboardsin.com). Lamar's Monroe office (2200 Millhaven Rd, 318-322-2970) doesn't publish prices, so get a quote. The closest listed board to the store is at **N 18th St and Louisville Ave**.

| Board | Size | Monthly rate |
|---|---|---|
| Junior poster | 11' × 5' | $800 |
| Poster | 22'8" × 10'5" | $1,500 |
| Digital bulletin (rotating slot) | 14' × 48' | $2,500 |
| Bulletin | 48' × 14' | $3,500 |

Printed vinyl is a one-time extra on static boards, about $3 per sq ft (national range $0.75–$8). Digital boards have no printing.

| Plan | What you get | Est. total |
|---|---|---|
| Starter | Junior poster near the store, 3 months | $2,600 |
| Recommended | Poster on a commuter route, 6 months | $8,800 |
| Holiday burst | Digital bulletin on a main road, 2 months | $5,000 |

`launch-book.html` has a calculator for any size and length.

```mermaid
flowchart TD
  A["Set the budget"] --> B["Ask Lamar and one other<br/>company for available boards"]
  B --> C{"Board on a route past<br/>Forsythe and N 18th?"}
  C -- "No" --> B
  C -- "Yes" --> D{"Static or digital?"}
  D -- "Static" --> E["Design proof<br/>plus printed vinyl"]
  D -- "Digital" --> F["Design only, no printing,<br/>message can change"]
  E --> G["Corporate brand approval"]
  F --> G
  G --> H["Sign the contract,<br/>ask for a longer-term rate"]
  H --> I["Board goes up"]
  I --> J["Ask for the proof-of-posting photo"]
```

## Season calendar

Hockey, high school sports and the holiday shipping rush overlap, so ads placed now can work for most of the year. The Moccasins opened Oct 9, 2026. Upcoming home games include Oct 17, Nov 6–7 and Nov 21 at 7:05 PM. School season dates are approximate.

```mermaid
gantt
  title Ad calendar, Oct 2026 to May 2027
  dateFormat YYYY-MM-DD
  axisFormat %b
  section Hockey
  Moccasins season (Monroe Civic Center) :active, 2026-10-09, 2027-04-17
  section High school
  Football (Fridays)        :2026-10-01, 2026-11-30
  Basketball                :2026-11-15, 2027-02-28
  Baseball and softball     :2027-02-15, 2027-05-15
  section Store
  Holiday shipping rush     :crit, 2026-11-20, 2026-12-24
  Digital billboard burst   :2026-11-01, 2026-12-31
  section Measure
  Count coupon codes monthly :2026-11-01, 2027-05-15
```

Moccasins home games found so far (from ticket listings; check the team schedule for changes):

```mermaid
timeline
  title Moccasins home games, Monroe Civic Center, 7.05 PM
  section October
    Oct 9 and 10 : Season opens vs Mid-South
    Oct 17 : vs Baton Rouge
    Oct 30 and 31 : Home weekend
  section November
    Nov 6 and 7 : vs Columbus
    Nov 21 : vs Baton Rouge
  section Winter
    Dec 29 : vs Mid-South
    Jan 8 and 9 : vs Mid-South
    Feb 5 : vs Mid-South
```

## Example budget split

An example of a first-year budget around $12,700. Change it to fit the actual rate cards.

```mermaid
pie showData
  title Example first-year ad budget ($)
  "Billboard (poster, 6 months)" : 8800
  "Moccasins dasher board" : 2500
  "Neville fence banner and program" : 1000
  "Other school banners" : 400
```

## Redeeming codes

Each code (MOCS10, TIGERS10) is good for **one use per customer**. The ads say so, and the counter enforces it with the **Coupon Counter** page on claude.ai (`coupon-counter.html`):
- Staff type in the code, the customer's name and a 10-digit phone number. Email is optional. Staff read a one-line consent note to the customer, who must say OK.
- The page records the redemption and refuses any later use of the same code with the same phone number.
- It flags **returning customers** ("welcome back, visit 3") as soon as staff type the phone number.
- The **Results** tab shows customers, returning customers, redemptions per week, and **cost per customer** for each code.
- The **Ad calendar** tab lists every placement with dates, cost, book-by deadline and contact, on a timeline from October to May. Deadlines within 30 days are flagged.
- It keeps a searchable log and exports it as CSV.
- Only people the owner shares the page with as **Contributor** or higher can see customer info or redeem codes. Only **Editors** can add or pause codes and change the ad calendar.

It runs in any modern browser (Chrome, Edge, Safari, Firefox) on Windows or Mac, signed in to claude.ai. Opening the local `.html` file won't connect to the log. Use the claude.ai link.

```mermaid
flowchart TD
  A["Customer gives a code"] --> B["Staff enter code, name, phone"]
  B --> C{"Code active?"}
  C -- "No" --> X["Refuse: not a current code"]
  C -- "Yes" --> D{"Name and 10-digit<br/>phone entered?"}
  D -- "No" --> Y["Ask for the missing info"]
  D -- "Yes" --> E{"This phone already<br/>used this code?"}
  E -- "Yes" --> Z["Refuse: already used,<br/>shows the earlier date"]
  E -- "No" --> F["Record it and approve"]
  F --> G["Apply the offer"]
  F --> H["Count goes up for that code"]
```

What happens behind the Redeem button:

```mermaid
sequenceDiagram
  actor C as Customer
  actor S as Staff
  participant P as Coupon Counter
  participant L as Redemption log
  C->>S: Code, name and phone
  S->>P: Enter code, name and phone
  P->>P: Code active? Name and 10-digit phone filled?
  P->>L: Hold this code and phone for 8 seconds
  P->>L: Look up this code and phone
  alt Already used
    L-->>P: Earlier redemption found
    P-->>S: Already used, with the date
    S-->>C: One use per customer
  else First use
    P->>L: Save name, phone, time and staff member
    P-->>S: Approved
    S-->>C: Offer applied
  end
```

How a code moves between states:

```mermaid
stateDiagram-v2
  [*] --> Active: Editor adds the code
  Active --> Paused: Editor pauses it
  Paused --> Active: Editor turns it back on
  Active --> Active: Redeemed, once per phone number
  Paused --> [*]: Season over
```

What the log stores:

```mermaid
erDiagram
  CODE ||--o{ REDEMPTION : "redeemed as"
  CODE {
    string code PK "MOCS10"
    string label "where it runs"
    boolean active
  }
  REDEMPTION {
    string id PK "code plus phone"
    string code FK
    string name
    string phone "10 digits"
    string email "optional"
    string redeemedAt
    string redeemedBy "staff member"
  }
```

## Measuring what works

```mermaid
flowchart LR
  A["Customer at the counter"] --> B{"Has a code?"}
  B -- "MOCS10" --> C["Coupon Counter<br/>counts Moccasins"]
  B -- "TIGERS10" --> D["Coupon Counter<br/>counts Neville"]
  B -- "No code" --> E["Ask: how did you hear about us?"]
  E --> F["Tally sheet: billboard,<br/>word of mouth, other"]
  C --> G["Monthly review"]
  D --> G
  F --> G
  G --> H["Put more money into<br/>what brings customers"]
```

The monthly review:

```mermaid
flowchart TD
  A["First Monday of the month"] --> B["Export the CSV<br/>from Coupon Counter"]
  B --> C["Count redemptions per code<br/>and the tally sheet"]
  C --> D["Divide each placement's cost<br/>by customers it brought in"]
  D --> E{"Cost per customer<br/>reasonable?"}
  E -- "Yes" --> F["Keep it, or renew<br/>next season"]
  E -- "No" --> G{"Fixable?<br/>new headline, new spot"}
  G -- "Yes" --> H["Change the ad<br/>in designs/"]
  G -- "No" --> I["Drop it and move<br/>the money"]
  H --> J["Re-export PNG and PDF,<br/>push, CI checks it"]
```

## Sources

- [Billboards in Monroe 71201, billboardsin.com](https://workhorse.billboardsin.com/market/monroe-louisiana/billboards/71201/)
- [Billboards in Monroe, AdQuick](https://AdQuick.com/billboard-locations/louisiana/monroe)
- [Monroe Moccasins sponsors page](https://www.moccasinshockey.com/sponsors)
- [Lamar Advertising, Monroe](https://www.lamar.com/monroe)
- [Goin' Postal franchise overview, franchising.com](https://www.franchising.com/goinpostal/)
