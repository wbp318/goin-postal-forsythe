# Agenda

Working list for the Forsythe store's marketing kit. Updated as each item is finished.

_Last updated: Oct 12, 2026_

## Status

| # | Item | What you get | Status |
|---|---|---|---|
| 0 | St. Frederick and Neville Junior High ads | Fence banner and program ad for each, codes STFRED10 and NJH10 | ✅ Done |
| 1 | QR codes | Program ads and counter flyer get a QR that opens directions to the store | ✅ Done |
| 2 | Weekly game-day posts | A ready-to-post PNG for every Moccasins home date found so far | ✅ Done |
| 3 | Holiday shipping deadline sign | Counter sign with 2026 carrier cutoff dates | ✅ Done |
| 4 | Coupon Counter: return customers | Flags repeat customers; first-time vs repeat counts | ✅ Done |
| 5 | Coupon Counter: cost per customer | Placement costs divided by redemptions, per code | ✅ Done |
| 6 | Coupon Counter: consent line | One sentence on why the phone number is collected | ✅ Done |
| 7 | Shared ad calendar | Every placement with dates, cost, renewal deadline and contact | ✅ Done |
| 8 | Moccasins promo night kit | Handout, table sign, social post, PA script | ✅ Done |
| 9 | Brand kit page | Colors, fonts and layout rules for printers and designers | ✅ Done |

## Progress

```mermaid
pie showData
  title Items by status
  "Done" : 10
  "In progress" : 0
```

## How the pieces connect

```mermaid
flowchart LR
  S0["#0 St. Fred and<br/>Neville Jr High ads"] --> S1["#1 QR codes on<br/>program ads and flyer"]
  S4["#4 Return customers"] --> CC["Coupon Counter upgrade"]
  S5["#5 Cost per customer"] --> CC
  S6["#6 Consent line"] --> CC
  S7["#7 Ad calendar"] --> S5
  CC --> R["Monthly review<br/>uses real numbers"]
  S2["#2 Game-day posts"] --> V["Visible all season"]
  S8["#8 Promo night kit"] --> V
  S3["#3 Holiday deadline sign"] --> V
  S9["#9 Brand kit"] --> P["Printers and designers<br/>match the look"]
```

## Plan

```mermaid
gantt
  title Build order
  dateFormat YYYY-MM-DD
  axisFormat %b %d
  section Designs
  St. Fred and Neville Jr High ads :done, a0, 2026-10-12, 1d
  QR codes                         :done, a1, 2026-10-12, 1d
  Game-day posts                   :done, a2, 2026-10-12, 1d
  Holiday deadline sign            :done, a3, 2026-10-12, 1d
  Promo night kit                  :done, a8, 2026-10-12, 1d
  Brand kit page                   :done, a9, 2026-10-12, 1d
  section Coupon Counter
  Return customers, cost, consent  :done, c1, 2026-10-12, 1d
  Ad calendar                      :done, c2, 2026-10-12, 1d
  section Wrap up
  README, gallery, exports, CI     :done, w1, 2026-10-12, 1d
```

## Coming up

Dates the work above depends on. Book-by dates are suggestions, not deadlines the venues set.

```mermaid
timeline
  title Next deadlines
  section October 2026
    Oct 16 : Book the Moccasins rink board to be up for the Oct 17 game
    Oct 17 : Moccasins home game, first game-day post
    Oct 23 : Book the digital holiday billboard to start Nov 1
    Late Oct : UPS usually publishes holiday dates, fill in the sign
  section November 2026
    Nov 1 : Digital holiday billboard starts
    Nov 6 and 7 : Moccasins vs Columbus
  section December 2026
    Dec 17 : Last day USPS Ground Advantage and FedEx Ground
    Dec 23 : Last day FedEx Standard Overnight
  section 2027
    Feb 1 : St. Frederick 2027 football program ads go on sale
```

## Follow-ups

```mermaid
flowchart LR
  A["Confirm Oct 30 and 31<br/>opponents"] --> B["Add them to make_game_posts.py<br/>and re-run"]
  C["UPS publishes 2026 dates"] --> D["Write them on the<br/>holiday sign"]
  E["Book a placement"] --> F["Enter actual cost in the<br/>Coupon Counter ad calendar"]
  F --> G["Cost per customer<br/>fills in on its own"]
  H["Get the logo from corporate"] --> I["Drop it in every<br/>OFFICIAL LOGO box"]
  I --> J["Corporate brand review,<br/>then print"]
```

## Log

- **Oct 12:** Agenda created. St. Frederick and Neville Junior High research and designs started.
- **Oct 12:** #0 done. Neville Junior High (1600 N 19th St, 0.4 mi, grades 7–8, Tigers) and St. Frederick (3300 Westminster Ave, 2.0 mi, grades 7–12, Warriors) confirmed. Fence banner and program ad made for each. Codes STFRED10 and NJH10 added to the Coupon Counter.
- **Oct 12:** #4–#7 done. Coupon Counter now has Redeem, Results and Ad calendar tabs: returning-customer flags, cost per customer, a consent line customers must OK, and a shared calendar with 10 planned placements (no costs yet; estimates in notes). Contributors can read the calendar; only editors can change it.
- **Oct 12:** #1 done. Program ads (Neville, St. Frederick, Neville Jr High) and the counter flyer now carry a QR that opens the Forsythe Ave & N 18th St corner in Google Maps. Tested: decodes from the exported PNGs.
- **Oct 12:** #2 done. Ten game-day posts in `designs/game-day/`, one per Moccasins home game found. Oct 30 and 31 opponents aren't confirmed yet, so those say "Moccasins home game". `scripts/make_game_posts.py` makes more.
- **Oct 12:** #3 done. Holiday sign with official 2026 dates: USPS (arrive by Dec 25) Ground Advantage Dec 17, Priority Mail Dec 18, Priority Mail Express Dec 19; FedEx (arrive by Dec 24) Ground Dec 17, Express Saver Dec 21, 2Day Dec 22, Standard Overnight Dec 23. UPS hasn't published yet, so its rows are write-in boxes.
- **Oct 12:** #8 done. Promo night handout, table sign and social post in `designs/promo-night/`, plus `docs/promo-night-kit.md` with PA scripts and checklists.
- **Oct 12:** #9 done. `brand-kit.html`: colors, type, label layout, logo slot, copy rules, legibility by medium, file formats.
- **Oct 12:** Everything added to the gallery, README and CI checks.
