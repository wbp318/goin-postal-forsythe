# The tech LLC: how the companies fit together, where to file, and every way to fund it

The store runs as **Wholesome Postal, LLC**, the company that holds the Goin' Postal franchise. This plan sets out three things:

- how the owners' other businesses should sit next to Wholesome Postal: PeterShip and the other software, the resale business, the deposit station and a future second store;
- which parish the tech company should file in, and what it takes to get started;
- every funding, credit, grant and accelerator option for a small software company in northeast Louisiana in late 2026.

Written November 7, 2026, at William's request, for Peter and Rin to decide. It builds on the PeterShip LLC plan and its draft papers in [`shipping-client/llc/`](../../shipping-client/llc/README.md), and on the [funding and sites plan](../funding/README.md).

**This is planning, not legal or tax advice.** Corporate structure, franchise agreements and taxes are exactly where a Louisiana business attorney and the store's accountant earn their fee. Take this page to them as the brief.

### How to read the charts

The same three colors as every chart in the repo ([full key](../README.md#how-to-read-the-charts)):

| Color | Meaning |
|---|---|
| Yellow | The owners' companies |
| Navy | Outside parties: GP Brands, the State, the IRS, banks, funders |
| Light blue | The owners themselves, and decisions for Peter and Rin |

## The short answer

| Question | Answer |
|---|---|
| **Should PeterShip and the rest be subsidiaries of Wholesome Postal?** | **No.** Keep **Wholesome Postal, LLC as the franchise store only**, and form **one tech LLC as a sister company** owned by Peter, Rin and William, as PeterShip's license already says. The tech LLC owns all the software and licenses it to the store. A holding company over everything comes later, with a second store or an investor ([section 1](#1-how-the-companies-fit-together)) |
| **What's the tech LLC?** | The **PeterShip LLC already planned** in [`shipping-client/llc/`](../../shipping-client/llc/README.md), widened to own every piece of the owners' software: PeterShip, the Mac mini automations, the resale scripts, the AI tools. A name like **PeterShip Technologies, LLC** keeps the brand and leaves room |
| **Which parish?** | **Ouachita.** Put the registered office and the principal office in Monroe, at the store or a small office. Two of the three members live there, the work and any staff will be there, and the free help at ULM is there. Louisiana's biggest software credit also needs a real Louisiana workplace with posted hours. Every funding program here is statewide, and sales tax on software follows the customer, not the company. **East Carroll** only makes sense if the company will truly operate and hire there ([section 2](#2-which-parish-to-file-in)) |
| **What does it cost to start?** | **$125** to file, **$25** to reserve the name, **$35 a year** after, a registered agent, a Monroe occupational license (gross-receipts based, small at first), and an attorney's review of the papers ([section 3](#3-getting-started-step-by-step)) |
| **Where's the money?** | In order of how real it is ([section 4](#4-every-way-to-fund-it)): <br>1. **Louisiana's Digital Interactive Media and Software credit:** 25% of developer payroll, refundable, no cap. It needs W-2 wages, so it waits for an S-corporation election and real salaries. <br>2. **USDA SBIR, Rural and Community Development:** $125,000 Phase I, plus LTTO's free $3,000 to write the proposal. <br>3. **Louisiana R&D credit:** 30% for small companies, through 2029. <br>4. **SSBCI micro loans** up to $100,000. <br>5. **Free, no-equity accelerators:** EAP, gBETA, Opportunity Machine, TBDC in Ruston. <br>6. **An NSF pitch** for a real AI research piece. <br>7. **High-Impact Jobs grants** once there are hires. <br>8. **Pitch money**, then the **Louisiana Growth Fund** ($250,000 to $1 million), which needs a C-corporation, revenue and a private investor. <br>Also: **$10,000 of Cloudflare credits** for PeterShip as soon as the LLC exists |
| **What's closed?** | Louisiana's **Angel Investor credit** (no new reservations after June 30, 2026), the **Innovation Retention Grant** (unfunded), the **Delta I-Fund** (ended 2022), the Enterprise Zone and Quality Jobs (2025) |

```mermaid
flowchart LR
  T["The tech LLC"]:::you --> C1["Credits on payroll and research<br/>Digital Media 25% (refundable)<br/>R&D 30% · High-Impact Jobs"]:::local
  T --> C2["Research grants<br/>USDA SBIR 8.6 $125k<br/>NSF pitch · LTTO $3k help"]:::local
  T --> C3["Loans<br/>SSBCI micro up to $100k<br/>loan guaranty · SBA"]:::local
  T --> C4["Credits and programs<br/>Cloudflare $10k<br/>EAP · gBETA · TBDC"]:::local
  T --> C5["Equity, later<br/>IDEApitch · Growth Fund<br/>$250k-$1M, C-corp only"]:::local
  T -.-> X["Closed<br/>Angel credit · Innovation<br/>Retention · Delta I-Fund"]:::cloud
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

## 1. How the companies fit together

### What there is now

```mermaid
flowchart TD
  PR["Peter and Rin"]:::you --> WP["Wholesome Postal, LLC<br/>the Goin' Postal franchise<br/>at 1800 Forsythe Ave"]:::local
  GP["GP Brands<br/>the franchisor"]:::cloud -->|"franchise agreement"| WP
  O3["Peter, Rin and William<br/>the three Owners in<br/>PeterShip's LICENSE"]:::you -.->|"own the code jointly<br/>today, no company"| PS["PeterShip<br/>the software"]:::local
  PS -.->|"used by"| WP
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

Two facts shape everything below:

1. **PeterShip has three owners and Wholesome Postal (as far as this plan knows) has two.** PeterShip's [`LICENSE`](../../shipping-client/LICENSE) names Peter, Rin and William as its Owners. If PeterShip were put under Wholesome Postal, William's third would have to come from somewhere: either a seat in Wholesome Postal, or a minority stake in the subsidiary. Both are awkward.
2. **Wholesome Postal is bound by the franchise agreement.** Franchise agreements commonly have three kinds of clause that matter here: limits on what other business the franchisee company may do, the franchisor's consent before ownership changes, and claims on improvements or systems developed "in connection with" the franchise. Which of these GP Brands' agreement has is the first question for the attorney (and it belongs with issue 11). Anything placed *inside* Wholesome Postal sits within the agreement's reach.

### The four ways to arrange it

```mermaid
flowchart TB
  subgraph A["A. Everything inside Wholesome Postal"]
    A1["Wholesome Postal, LLC<br/>store + PeterShip + resale<br/>+ deposits, as divisions"]:::local
  end
  subgraph B["B. Subsidiaries under Wholesome Postal"]
    B1["Wholesome Postal, LLC"]:::local --> B2["PeterShip LLC"]:::local
    B1 --> B3["Resale LLC"]:::local
  end
  subgraph C["C. A holding company over sister companies"]
    C0["Holding LLC<br/>Peter, Rin, William"]:::you --> C1["Wholesome Postal"]:::local
    C0 --> C2["Tech LLC"]:::local
    C0 --> C3["Resale LLC"]:::local
  end
  subgraph D["D. Sister companies owned by the people"]
    D0["Peter and Rin"]:::you --> D1["Wholesome Postal"]:::local
    D9["Peter, Rin, William"]:::you --> D2["Tech LLC<br/>PeterShip and the software"]:::local
  end
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

| | A. All inside Wholesome Postal | B. Subsidiaries of Wholesome Postal | C. Holding company over sisters | **D. Sisters owned by the people (recommended now)** |
|---|---|---|---|---|
| **One problem can sink the rest?** | Yes: a store lawsuit or lease default reaches PeterShip and the stock | Partly: a subsidiary's debts stay in it, but the parent *owns* the subsidiaries, so the store's creditors can reach those shares | No: each company stands alone | No: each company stands alone |
| **Franchise agreement's reach** | Everything is inside it | The subsidiaries are owned by the franchisee: arguable reach, and any restriction on the franchisee's "other business" bites | Wholesome Postal stays a single-purpose franchisee, which franchisors prefer | Same as C |
| **Selling PeterShip** | A buyer must carve it out of the store's company | Wholesome Postal sells its subsidiary; the proceeds land in the franchisee | Clean: the holding sells the tech LLC | **Clean: the three owners sell the tech LLC** |
| **William's third of PeterShip** | Needs a seat in Wholesome Postal | Needs a minority stake in the subsidiary next to Wholesome Postal | A share of the holding (but then he also owns part of the store) | **Direct, exactly as the LICENSE already says** |
| **Changes Wholesome Postal's ownership?** | No | No | **Yes**: moving Wholesome Postal under a holding is an ownership change that usually needs GP Brands' written consent, maybe a transfer fee | No |
| **Tax returns** | One partnership return | Subsidiaries owned 100% by the parent are disregarded; one with William in it files its own | One partnership return for the holding; 100%-owned sisters are disregarded | One return per multi-member company: Wholesome Postal's (already filed) and the tech LLC's |
| **Cost to set up** | Nothing new | $125 per subsidiary, $35 a year each | A holding plus each company, and the franchise consent | **$125 for the tech LLC, $35 a year** |
| **Verdict** | No: puts PeterShip inside the franchise and the store's risks | No: William's share and the franchise problem | **Later**, once there are three or more businesses, a second store, or an investor | **Now** |

### Recommended now: sister companies, each with one job

```mermaid
flowchart TD
  PR["Peter and Rin"]:::you --> WP["Wholesome Postal, LLC<br/>the franchise store only<br/>+ the deposit station, if GP Brands allows it"]:::local
  ALL["Peter, Rin and William"]:::you --> IT["The tech LLC<br/>(PeterShip Technologies, LLC?)<br/>PeterShip, the Mac mini automations,<br/>the AI tools, any software sold"]:::local
  WOR["Owners decide<br/>(decision 1 in the resale plan)"]:::you -.-> RS["Resale: a division of<br/>Wholesome Postal, or its own<br/>Resale LLC if GP Brands objects<br/>or William's stock is consigned"]:::local
  IT -->|"software license,<br/>monthly fee"| WP
  IT -.->|"license"| RS
  GP["GP Brands"]:::cloud -->|"franchise agreement"| WP
  IT -.->|"later: license to other<br/>stores, or a sale"| BUY["Other stores, GP Brands,<br/>Auctane, Shopify"]:::cloud
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

- **Wholesome Postal, LLC stays the franchise store** and nothing else, except what has to happen at its counter under its name. The Green Dot or InComm deposit agreement will be with the company that runs the location, which is Wholesome Postal, if GP Brands allows it (issue 27).
- **The tech LLC is a sister company owned by the three Owners**, exactly as PeterShip's LICENSE already reads. It owns PeterShip and every other piece of software the owners build: the Mac mini automations, the resale scripts, the tornado, the x402 gate. It **licenses** the software to Wholesome Postal for a monthly fee, under the draft license in [`shipping-client/llc/`](../../shipping-client/llc/software-license-to-store.md). The store deducts the fee as a business expense. The tech LLC earns it, at an arm's-length price the accountant agrees.
- **Resale depends on its own decision 1.** If the store buys William's stock and GP Brands has no objection, resale can run as a division of Wholesome Postal (one sales tax account, the store's counter). If William's stock is on consignment, if GP Brands objects to non-franchise goods, or if the owners want its risks (returns, marketplace disputes, stock in other parishes) kept apart, it becomes its own LLC.
- **A second store** (West Carroll, agenda item 51) gets its own company, because franchisors usually want one franchisee entity per location. **That is the point to form a holding company** (option C), with GP Brands' consent, so the stores and the tech LLC sit under one owner the family controls.

**Should anything be a subsidiary of Wholesome Postal? No.** It would put the software inside the franchise's reach, tie William's share to the store, and let the store's creditors reach what the owners most want to sell.

### Questions for the attorney and GP Brands, before anything is filed

1. Who are Wholesome Postal's members, and in what shares? Its articles and operating agreement, please.
2. What does the franchise agreement say about the franchisee company doing other business, about other companies the owners control, and about software or "improvements" developed by the owners?
3. Does running PeterShip, a resale business or the deposit station need GP Brands' consent? (Add to issue 11's email.)
4. Is the draft license from the tech LLC to Wholesome Postal acceptable to GP Brands, given the franchise's own systems (GP Rate Pro)?
5. If a holding company comes later, what consent and fees does an ownership change need?

## 2. Which parish to file in

A Louisiana LLC is formed by filing with the **Secretary of State** on geauxBIZ, not with a parish. The parish question is where its **registered office** and **principal office** are. That decides only a few things:

| What depends on the parish | Ouachita (Monroe) | East Carroll (Lake Providence) | Lincoln (Ruston) |
|---|---|---|---|
| **Occupational license** (owed where the business actually is) | City of Monroe Tax & Revenue, 1401 Stubbs Ave; due by the end of February; fee by gross receipts | The sheriff collects it (from an old audit; unconfirmed today) | Unconfirmed |
| **Property tax on equipment** (form LAT 5 to the assessor yearly) | Parish rate | Parish rate | Parish rate |
| **Sales tax on software and SaaS** (taxable in Louisiana since Jan 1, 2025) | **Follows the customer's location, not the company's**: the parish doesn't change it | Same | Same |
| **High-Impact Jobs grants** (wage thresholds set by the project's parish) | 125% of average: $62,574 | **$52,289, the lowest** | $57,806 |
| **The Digital Media software credit** | Needs a physical Louisiana workplace with posted hours and a full-time employee: easiest at a Monroe office or the store | Possible only with a real office there | Possible at LaTEC's space, if accepted |
| **Where the owners are** | **Peter and Rin live here; the store is here** | **William lives here** and writes the software | No one |
| **Free help and programs nearby** | **LSBDC at ULM** | LSBDC at ULM serves it | **TBDC and LaTEC** (Louisiana Tech) |
| **Everything else** (SSBCI, R&D, Digital Media, SBIR, Growth Fund) | Statewide | Statewide | Statewide |

```mermaid
flowchart TD
  Q["Where does the tech LLC<br/>really work and hire?"]:::you --> M{"A Monroe office<br/>or the store?"}
  M -->|"yes (likely)"| O["Ouachita Parish:<br/>registered office in Monroe,<br/>Monroe occupational license,<br/>Digital Media credit's<br/>workplace test is easy"]:::local
  M -->|"no: a real office<br/>and hires in East Carroll"| E["East Carroll Parish:<br/>lowest High-Impact Jobs<br/>thresholds, rural, William's home"]:::local
  M -->|"no: moving into LaTEC"| L["Lincoln Parish:<br/>Louisiana Tech's incubator"]:::local
  O -.->|"William still works from<br/>East Carroll: his W-2 pay is<br/>Louisiana-resident payroll"| W["Counts for the Digital<br/>Media credit either way"]:::local
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

**Recommendation: Ouachita Parish**, as the existing PeterShip LLC plan already says. Use the store's address (1800 Forsythe Ave Ste 2, Monroe) or a small Monroe office as the registered and principal office, with Peter as registered agent if he's willing. It's where two members live and where the company will work. The one credit with a workplace test is easiest to meet there, and nothing statewide favors another parish. William's work from East Carroll still counts as Louisiana-resident payroll. Choose **East Carroll** only if the company will really open an office and hire there: then it gets the lowest High-Impact Jobs wage thresholds and HUBZone if the map allows (federal contracting only).

## 3. Getting started, step by step

```mermaid
flowchart TD
  S0["Week 1<br/>Owners agree: structure D,<br/>name, percentages, manager"]:::you --> S1["Week 1 to 2<br/>Attorney: franchise agreement<br/>questions, operating agreement,<br/>IP assignment, store license"]:::cloud
  S1 --> S2["Week 2<br/>geauxBIZ: reserve name $25,<br/>file articles + initial report $125"]:::local
  S2 --> S3["Same day<br/>EIN from the IRS, free"]:::local
  S3 --> S4["Week 3<br/>bank account; sign the IP<br/>assignment and the license<br/>to Wholesome Postal"]:::local
  S4 --> S5["Week 3 to 4<br/>Monroe occupational license;<br/>Louisiana Revenue registration<br/>(SaaS sales tax, payroll later)"]:::local
  S5 --> S6["Month 1<br/>move Cloudflare, GitHub,<br/>Anthropic, Stripe, the domain<br/>to the company; insurance"]:::local
  S6 --> S7["Month 1<br/>first money: Cloudflare credits,<br/>LSBDC and TBDC sessions,<br/>LTTO call, EAP or gBETA"]:::local
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

| # | Step | Who | Cost | Notes |
|---|---|---|---|---|
| 1 | Agree the structure (sister companies, section 1), the name, each member's percentage and capital, and the manager | Peter, Rin, William | | The PeterShip LLC plan's decisions 1 to 5 still apply ([`shipping-client/llc/`](../../shipping-client/llc/README.md#decisions-for-peter-and-rin)) |
| 2 | Attorney review: the franchise agreement questions (section 1), the [operating agreement](../../shipping-client/llc/operating-agreement.md), the [IP assignment](../../shipping-client/llc/ip-assignment.md) and the [license to the store](../../shipping-client/llc/software-license-to-store.md), widened from "PeterShip" to all the owners' software | A Louisiana business attorney | A few hundred to a couple of thousand dollars | The drafts exist; the attorney edits rather than starts |
| 3 | Reserve the name on geauxBIZ | Peter | $25 | "LLC" or "L.L.C." in the name |
| 4 | File the Articles of Organization with the Initial Report and the registered agent's notarized acceptance | Peter | $125 (since Oct 1, 2026) | [`articles-and-initial-report.md`](../../shipping-client/llc/articles-and-initial-report.md) lists every field; registered office in Monroe |
| 5 | Get the EIN | Peter | Free, same day | irs.gov |
| 6 | Open the company's bank account | Peter | | Keep the tech LLC's money apart from Wholesome Postal's from day one |
| 7 | Sign the IP assignment (dated after the LLC exists) and the license to Wholesome Postal | All three; Peter for the store | | The license fee is an arm's-length monthly price the accountant agrees |
| 8 | Monroe occupational license | Peter | Small, by gross receipts | City of Monroe Tax & Revenue, 1401 Stubbs Ave; renew by the end of February |
| 9 | Register with Louisiana Revenue | Accountant | | Sales tax on SaaS and digital products sold to Louisiana customers since Jan 1, 2025; withholding once anyone is on payroll |
| 10 | Move the accounts to the company | William, Peter | | Cloudflare (hosts PeterShip), GitHub, the Anthropic Console organization for the Mac minis, Stripe, the domain, carrier developer accounts |
| 11 | Insurance | Peter | Get quotes | General liability, and technology errors and omissions or cyber cover for a platform that buys labels and holds customers' addresses |
| 12 | First funding moves | William | Free | Cloudflare for Startups; a session at the LSBDC at ULM; call TBDC (318-257-3537) and LTTO (Hutch McClendon); apply to EAP or gBETA |
| 13 | Every year | Peter, accountant | $35 | Annual report on geauxBIZ; Form 1065 and K-1s; LAT 5 to the assessor; the occupational license |

### The tax path

```mermaid
flowchart LR
  P["Now: partnership<br/>(an LLC's default)<br/>Form 1065, K-1s"]:::local -->|"once the owners draw<br/>real developer pay,<br/>about $100k a year+"| S["S-corporation election<br/>(Form 2553): owners on<br/>W-2 payroll, so the<br/>Digital Media 25% credit counts"]:::local
  S -->|"only to raise venture<br/>or Growth Fund money"| C["Convert to a<br/>C-corporation"]:::local
  classDef local fill:#f2b705,stroke:#3b2c00,color:#3b2c00
  classDef cloud fill:#0f1d3a,stroke:#0f1d3a,color:#ffffff
  classDef you fill:#e8f1fb,stroke:#1d4ed8,color:#17202d
```

- **A three-member LLC is a partnership for tax** unless it elects otherwise. Members of a partnership aren't employees, so **their pay isn't W-2 wages**, and **Louisiana's Digital Media credit counts only W-2 payroll**. Electing S-corporation treatment lets the owners draw W-2 salaries, which turns the credit on.
- That's worth it once developer payroll is around **$100,000 a year** or more. The credit's application fee and CPA verification (a $7,500 deposit, up to $15,000) eat smaller claims.
- **The Louisiana Growth Fund invests only in C-corporations.** Convert only when raising equity.
- The accountant decides the timing; this is the shape.

## 4. Every way to fund it

### Ranked by how real it is for this company

| # | Option | Amount | Status, Nov 2026 | What it needs | Fit |
|---|---|---|---|---|---|
| 1 | **Digital Interactive Media and Software credit** (R.S. 47:6022) | **25% of Louisiana-resident W-2 developer payroll**, 18% of other qualified spending; **refundable**, or 85% as a rebate any time | **Active, no cap, no minimum** | Business or enterprise software (not internal-only), a physical Louisiana workplace with posted hours and one full-time employee; apply on LED FastLane **before** the spending; LED-assigned CPA verifies | **The biggest and steadiest.** Waits for W-2 pay (the S-corp election) |
| 2 | **USDA SBIR, topic 8.6, Rural and Community Development** | Phase I **$125,000** over 8 months | FY2027 request date unconfirmed | One of the few SBIR topics that allows existing technology used in a new way, for rural quality of life | **Best federal fit:** rural Delta sellers shipping at fair rates |
| 3 | **LTTO SBIR "Phase 0"** | Up to **$3,000** toward a Phase I proposal, $5,000 toward Phase II | Active, free | Interest form; Hutch McClendon, Hutch.McClendon@la.gov | Pays for the proposal writing |
| 4 | **Louisiana R&D credit** (R.S. 47:6015) | **30%** of qualified research spending above a base (under 50 employees), plus **30% of any SBIR award** | Active through spending in 2029; $12 million statewide cap a year, first come | Apply to LED within a year of the spending; not refundable (5-year carry-forward) | Good once there's profit and real experiments |
| 5 | **SSBCI "Louisiana Opportunity Capital"** | **Micro loans up to $100,000**; loan guaranty up to $1.5M; collateral support up to $1M | Active | Through LED-approved lenders (ask a Monroe bank); LEDSSBCI2@la.gov | Working capital without giving up equity |
| 6 | **Free, no-equity accelerators** | Coaching, mentors, investor introductions | **EAP** (Shreveport, rolling, 0% equity); **gBETA Gulf Coast** (gener8tor, free); **Opportunity Machine** Builder (Lafayette, 10 weeks); **TBDC** at Louisiana Tech (I-20 corridor tech ventures) | Applications | Worth a cohort before any pitch |
| 7 | **NSF SBIR Project Pitch** | Phase I up to **$305,000**; Phase II up to $1.25M | Next pitch deadline **March 4, 2027**, then July 7 | A pitch first, then an invited proposal; "high-risk technical innovation" | Only for a real research piece (below) |
| 8 | **High-Impact Jobs grants** (R.S. 51:2771) | **8% to 22%** of new jobs' wages for 3 years plus 2 | Active | One new job is enough; pays 110% to 150% of the parish average, with health benefits, held by Louisiana residents | Once there are hires |
| 9 | **Cloudflare for Startups** | **$10,000** in credits | Open | A live site, a company email domain | **First thing to claim** once the LLC exists |
| 10 | **Pitch money** | IDEApitch at New Orleans Entrepreneur Week (March 8 to 13, 2027); Innovation Catalyst's BREW (Baton Rouge) | Annual | A deck and a demo | Visibility and investors |
| 11 | **Louisiana Growth Fund** (LA.IO, run by Yellow Ventures) | **$250,000 to $1 million**, seed to Series A | Open | A Louisiana **C-corporation** with **revenue**, matched 1:1 by private investment closing within 90 days; no SAFEs | Later, if the owners want investors |
| 12 | **SBA loans** (the [funding plan](../funding/README.md#3-loans-where-the-real-money-is)) | 7(a) Small up to $350,000; Express up to $500,000; microloans up to $50,000 | Active | Every owner a U.S. citizen or national; 10% injection; guarantees | If the bank prefers SBA to SSBCI |

### An honest word on research money

Most of PeterShip is **integration work**: comparing carrier rates, buying labels, connecting marketplaces. NSF would almost certainly decline that as research, and the R&D credit requires that most of the work be real experimentation. The **research-shaped pieces** are narrower and real:

- **Predicting a package's size and weight from a listing's photos and words** (the resale drafts already do a rough version), measured against real packed weights.
- **Batching rural pickups and deliveries** across the Delta's scattered stockrooms and sellers.

Those are the pieces to put in an NSF pitch or the USDA rural topic, and to track separately for the R&D credit.

### Closed or not a fit

| Program | Why not |
|---|---|
| **Angel Investor Tax Credit** | Closed to new reservations after June 30, 2026 (Act 515 of 2025), including its 35% rate for small parishes |
| **Innovation Retention Grant** (up to $100,000 for SBIR winners) | Unfunded since its only round closed June 30, 2024; a 2026 bill to fund it died |
| **Delta I-Fund** (Winrock) | Ended March 2022 |
| **Rural Tech Catalyst Fund** | Rural health technology only |
| **Louisiana Institute for Super Intelligence** | Helping 5,000 small businesses adopt AI tools; no startup money found |
| **Enterprise Zone, Quality Jobs** | Closed June 30, 2025 |
| **DOE SBIR** | No fit |
| **Startup Prize (Shreveport)** | Health and energy tracks only |

## Decisions for Peter and Rin (and William)

1. **Structure:** sister companies now (Wholesome Postal stays the franchise store; a tech LLC owned by all three), and a holding company only with a second store or an investor?
2. **Wholesome Postal's members and shares,** and the franchise agreement's clauses on other business and owner-developed software. Send both to the attorney.
3. **The tech LLC's name:** PeterShip Technologies, LLC, plain PeterShip, LLC, or something broader?
4. **Percentages, capital and manager** (the PeterShip LLC plan's decisions, still open).
5. **Parish:** Ouachita (recommended), with the store's address or a small Monroe office?
6. **Resale:** a division of Wholesome Postal or its own LLC (ties to the resale plan's decision 1)?
7. **When to elect S-corporation treatment** so the owners' developer pay earns the 25% Digital Media credit?
8. **Which first funding moves:** Cloudflare credits, an LSBDC session, TBDC and LTTO calls, an EAP or gBETA application, an NSF pitch by March 4, 2027?

## Could not confirm

- Wholesome Postal's members, shares and franchise agreement terms (only the owners have them).
- The exact Secretary of State fees in the October 2026 schedule (the fee sheet's columns are jumbled; $125 to file and $35 a year match the earlier research).
- Whether Louisiana requires any parish filing for a new LLC (none found).
- East Carroll's and Lincoln's occupational license offices and fees today; the fee tables at low revenue.
- TBDC and LaTEC terms for founders outside Louisiana Tech, and any 2026 cohort.
- The next cohorts for gBETA Gulf Coast and Opportunity Machine; IDEApitch 2027 prize amounts.
- USDA SBIR's FY2027 request date; SSBCI seed check sizes.
- A 2025 extension of the R&D credit beyond what the statute shows.

## Sources

**Louisiana credits and programs:** [Digital Interactive Media and Software Program](https://www.opportunitylouisiana.gov/incentive/digital-interactive-media-and-software-program), [LED incentive book, June 2026](https://admin.opportunitylouisiana.gov/wp-content/uploads/2026/06/LED-Incentive-Book-Digital-007h.pdf), [R.S. 47:6022](https://legis.la.gov/legis/LawPrint.aspx?d=321886), [R&D credit, R.S. 47:6015](https://www.legis.la.gov/Legis/Law.aspx?p=y&d=102372) and [LED page](https://www.opportunitylouisiana.gov/incentive/research-and-development-tax-credit), [Angel credit, HB 665 / Act 515 of 2025](https://legis.la.gov/legis/BillInfo.aspx?s=25RS&b=HB665&sbi=y), [Innovation Retention Grant](https://www.opportunitylouisiana.gov/faqs/when-is-the-open-application-period-for-the-innovation-retention-grant-program), [SB 515 of 2026](https://legis.la.gov/legis/BillInfo.aspx?s=26RS&b=SB515&sbi=y), [LTTO](https://www.opportunitylouisiana.gov/ltto), [Louisiana Growth Fund](https://la.io/the-louisiana-growth-fund/), [LA.IO capital](https://la.io/capital/), [SSBCI](https://www.louisianassbci.com/), [High-Impact Jobs](https://www.opportunitylouisiana.gov/incentive/high-impact-jobs) and [parish wages, March 2026](https://admin.opportunitylouisiana.gov/wp-content/uploads/2026/03/HIP-Parish-Wages-3.16.26.pdf), [LED innovation](https://www.opportunitylouisiana.gov/innovation)

**Accelerators and pitches:** [The Enterprise Center at Louisiana Tech](https://opportunitylouisiana.gov/resource/the-enterprise-center-at-louisiana-tech), [EAP](https://www.eapla.com/), [Opportunity Machine](https://opportunitylouisiana.gov/resource/opportunity-machine), [Idea Village VILLAGEx](https://bizneworleans.com/the-idea-village-announces-2026-villagex-cohort/), [gener8tor](https://www.gener8tor.com/accelerators), [New Orleans Entrepreneur Week 2027](https://cecd.loyno.edu/news/oct-15-2025_new-orleans-entrepreneur-week-announces-2026-dates), [Innovation Catalyst](https://www.innovationcatalyst.us/), [Delta I-Fund II](https://winrock.org/projects/delta-i-fund-ii/)

**Federal:** [NSF SBIR/STTR, NSF 26-510](https://www.nsf.gov/funding/opportunities/small-business-innovation-research-small-business-technology/nsf26-510/solicitation), [NSF AI topic](https://seedfund.nsf.gov/topics/artificial-intelligence/), [USDA SBIR topic areas](https://www.nifa.usda.gov/grants/programs/sbir-sttr/sbir-topic-areas), [USDA topic 8.6](https://www.sbir.gov/topics/11107), [Cloudflare for Startups](https://www.cloudflare.com/forstartups/)

**Forming and taxes:** [Secretary of State fee changes, 2026](https://static.sos.la.gov/shared/fee_changes_2026.pdf), [file business documents](https://sos.la.gov/business-services/file-business-documents), [City of Monroe Taxation & Revenue](https://monroela.us/departments/administration/taxation-revenue/), [Louisiana digital products guidance](https://dam.ldr.la.gov/lawspolicies/Digital%20Products%20Guidance.Final.pdf), [what services are taxable](https://revenue.louisiana.gov/tax-education-and-faqs/faqs/sales-tax-reform/what-services-are-subject-to-sales-tax-in-louisiana/), [LAT 5 form](https://lafayetteassessor.com/assets/forms/LAT-5-WITH-INSTRUCTIONS.pdf)
