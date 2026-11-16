# Peter's to-do list

Ideas and projects Peter wants to do later. Each one has what it is, why it's waiting, and the steps when it's time. Finished items move to [EDIT-LOG.md](EDIT-LOG.md).

| # | Item | Status | Waiting on |
|---|---|---|---|
| P1 | [International shipping online](#p1-international-shipping-online) | ⏸ Later | The US-only site going live, then a talk with William and Rin |
| P2 | [Return labels on the Ship page](#p2-return-labels-on-the-ship-page) | ✅ Done Nov 14 | Pay-only-if-used is D9 in FOR-WILLIAM.md |
| P3 | [Insurance terms: do's and don'ts, limits, what can't be insured](#p3-insurance-terms-dos-and-donts-limits-what-cant-be-insured) | ⏸ Later | Research each carrier's rules first |
| P4 | [Find a texting (SMS) platform for messages and marketing](#p4-find-a-texting-sms-platform-for-messages-and-marketing) | ⏳ Next to research | Pick the platform, then register the store's texting |
| P5 | ["Sign in with Google"](#p5-sign-in-with-google) | ⏸ Later | The site's real web address, a privacy policy page, and Peter's Google setup |
| P6 | [A fresher website theme](#p6-a-fresher-website-theme) | ✅ Done Nov 14: Theme B | A larger logo file from franchise support would be sharper |
| P7 | [Print & Promo online: the e-commerce side, first](#p7-print--promo-online-the-e-commerce-side-first) | ⏳ In progress (steps 1, 2, 2b ✅) | 2c full-screen card editor; 2d free sample pack; then step 3, request a quote |
| P8 | [Online shipping labels, later and on purpose](#p8-online-shipping-labels-later-and-on-purpose) | ⏸ On the sideline | P7 earning first; then the checks below |
| P9 | [Find a business card supplier, and price to compete](#p9-find-a-business-card-supplier-and-price-to-compete) | ⏳ Next to research | Calls and quotes from suppliers; answers D20 in FOR-WILLIAM.md |
| P14 | [Raise mailbox prices $2 to $5 each](#p14-raise-mailbox-prices-2-to-5-each) | ⏸ Peter to pick the figure | Peter's numbers; then one file on the website and the Prices tab in William's register |
| P13 | [Virtual mail on the website](#p13-virtual-mail-on-the-website) | ⏸ Later | What virtual mail we sell and at what price; Anytime Mailbox's rules |
| P12 | [Automatic mailbox reminders](#p12-automatic-mailbox-reminders) | ⏳ Next for mailboxes | A daily scheduled job on Cloudflare; Peter's revision of the mailbox pages |
| P11 | [Official carrier logos (USPS, UPS, FedEx, DHL)](#p11-official-carrier-logos-usps-ups-fedex-dhl) | ✅ Done Nov 15 | A larger UPS file would be sharper | Goin' Postal corporate or each carrier's retail program |
| P10 | [Is real AI design worth about 2 cents a try?](#p10-is-real-ai-design-worth-about-2-cents-a-try) | ⏸ Decide later | Peter and Rin try the demo; then the key and a monthly cap (D22) |

---

## P1. International shipping online

**Added:** November 14, 2026. **Status:** later, not started.

**What it is:** Let customers buy international labels on the website, the way Pirate Ship does. Today the website is US-only (William took international out on November 7, 2026, v1.92.0, for risk). International still works at the counter, where staff can see the item.

**Why it's waiting:**
1. The US-only site isn't live yet (carrier and payment keys are still pending).
2. The business paperwork takes longer than the code, so it comes first.
3. William removed it on purpose, so it's a joint decision with William and Rin.

### How Pirate Ship does it (the model to copy)

- The **customer fills in the customs form** online: each item, quantity, value, country it was made in.
- The **customer certifies it's true**, and the terms of service make the sender responsible for what's in the box.
- The customs data goes to the carrier **electronically** with the label.
- Banned countries and banned people are **screened out**; shipments needing extra government filings are refused.
- Pirate Ship **never handles the box**.

### Where the store has more risk than Pirate Ship

- Labels are bought on the **store's own carrier account**, so a bad package can get the store's account fined or suspended.
- Customers may bring the box to the **counter**, where staff accept it.

### Steps: business first

- [ ] Talk it over with William and Rin: why it was removed, and whether the plan below answers it.
- [ ] Terms of service that make the sender responsible for the contents and the customs form (lawyer writes or reviews).
- [ ] Confirm with USPS (and later UPS, FedEx) and with GP Brands that the store's accounts may sell international labels online.
- [ ] A counter rule: staff ask what's inside and may refuse a box.

### Steps: the build (a few days of work once the business steps are done)

- [ ] Customs form in checkout: items, quantity, value, weight, country of origin, contents type (gift, merchandise, documents, return), and a "this is true" checkbox.
- [ ] Start with **USPS only**, to a short list of countries.
- [ ] Block sanctioned countries, and check sender and receiver names against the US government's Consolidated Screening List.
- [ ] Online orders capped at **$2,500**; anything above goes to the counter (it needs an extra government export filing).
- [ ] A clear warning that the receiver may owe duties and taxes on delivery.
- [ ] Bring back what's useful from the old international code in the project history (before v1.92.0).

### Questions for William and Rin

1. What risk made you remove it, and does the sender-certifies model above cover it?
2. Which countries would customers actually ship to? (Start with those.)
3. Is the counter enough for now, or is online international worth the setup?

---

## P2. Return labels on the Ship page

**Added:** November 14, 2026. **Status:** ✅ done November 14, 2026, 12:37 CST (see EDIT-LOG.md). Answers used: charged up front for now; the same service back where offered, else the cheapest; both labels on the done page and in the receipt, for the customer to pass on.

**What it is:** A "Return label" checkbox on the Ship page, like Pirate Ship's, so a seller can buy the outgoing label and a prepaid label back to themselves in one checkout.

**Why it waited:** It's the biggest of the extra services (a second label, its own price, how and when it's charged), so it gets its own edit right after the other checkboxes.

**Already in the project to build on:** the counter can make return labels today (the "This is a return" box on /counter/queue), there's a returns drop-off page, and the add-on list has "Print a return label from a phone or email" and "Box for a return".

**Questions to settle when building it:**
1. Charge the return label up front, or only if it's used? (Up front is simpler; only-if-used depends on the carrier.)
2. Same service as the outgoing label, or the cheapest?
3. Email it to the sender, or to the receiver to keep in the box?

---

## P3. Insurance terms: do's and don'ts, limits, what can't be insured

**Added:** 2026-11-14 13:08 CST. **Status:** later, not started. Nothing goes on the website until each carrier's rules have been read and checked.

**What it is:** A short, plain-English insurance disclaimer on the Ship page, next to the insurance box, with a "Read the insurance terms" link that opens a window (like the hazardous materials guide). It tells customers before they pay:
- **Do's:** pack it properly, keep the receipt or proof of value, keep the box and packing if it arrives damaged, report problems quickly.
- **Don'ts:** don't over-declare the value, don't ship items the carrier won't cover, don't throw away the damaged box before the claim is decided.
- **How much can be insured**, with which carrier and service.
- **What can't be insured** at all, and what's only covered up to a lower amount.
- **How a claim works** and how long the customer has to file.

**Why it's waiting:** each carrier (USPS, UPS, FedEx) has its own rules, limits and exclusions, and they change. They have to be read from each carrier's own published terms, not guessed. A wrong promise here could cost the store money on a denied claim.

**What the site does today, for reference:**
- Insurance is offered up to **$5,000** declared value; the first **$100** is the carrier's built-in cover at no charge (both set at /counter/rules, stored in `site/src/data/addons.json`).
- Since Nov 14, the insured amount is added to the label as the carrier's own insurance or declared value (see EDIT-LOG.md).
- "What's inside" and the value are asked only when insurance is ticked.

### Research checklist, per carrier (USPS, UPS, FedEx)

- [ ] The **maximum** that can be insured or declared, by service. Does it differ for envelopes, flat rate packaging, or Ground versus Express?
- [ ] What the carrier **covers for free** (built-in cover), by service.
- [ ] Items that are **never covered** (for example cash, and other things the carrier lists).
- [ ] Items covered only **up to a lower limit** (for example jewelry, art, collectibles, or other "unusual value" items, if the carrier has such a rule).
- [ ] **Packing rules** a claim depends on (what counts as "properly packed").
- [ ] **Proof** the carrier asks for in a claim: receipts, photos, the box.
- [ ] **Deadlines** to report damage or loss and to file a claim.
- [ ] Who files: the customer or the store (the store's account bought the label).
- [ ] Whether the store's **$5,000** maximum should be lower for some carriers or services.

### Then decide

1. The wording of the disclaimer and the do's and don'ts.
2. Whether the website should **block** insurance that a carrier won't honor (over a carrier's limit, or an excluded item), not just warn.
3. Whether the customer ticks **"I've read the insurance terms"** before paying.
4. How it fits with the open insurance questions in [FOR-WILLIAM.md](FOR-WILLIAM.md): D1 (the fee covers the carrier's cost?), D7 ("we handle your claim" as a selling point), D8 (which insurance the counter uses today).
5. A lawyer or the franchise reviews the final wording.

---

## P4. Find a texting (SMS) platform for messages and marketing

**Added:** 2026-11-14 14:13 CST. **Status:** to research.

**What it is:** A service to send the store's texts: shipping updates (already built) and, with the customer's yes, deals and news. Customers now give their mobile number when they buy online, and can tick "Text me deals" (logged as proof in the `marketing_consents` table).

**What's already in place:**
- The site sends "Text me when it ships" messages through **Twilio** (set up in `site/.dev.vars`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`), but no Twilio account is connected yet, so texts are only logged.
- Email goes through **Resend**, also not connected yet.
- Marketing consent is collected and logged with the exact wording, time and source. Nothing sends marketing yet.

### Questions to answer

- [ ] **One platform or two?** Twilio can send both shipping updates and marketing, but marketing campaigns are easier on a platform built for them (lists, scheduling, opt-out handling, reports). Compare a sending service (Twilio, Telnyx, and similar) with marketing tools (SimpleTexting, EZ Texting, Textedly, and similar). Check prices on their own sites, since they change.
- [ ] Does it **import our consent list** (or connect to the site) and send **opt-outs back**, so a STOP reply also turns off "Text me deals" on the customer's account?
- [ ] **Number type:** a regular local number (needs "10DLC" registration), a toll-free number (needs toll-free verification), or a short code (costly, slow). The store's Monroe area code is a nice touch.
- [ ] Monthly cost at the store's volume, per-message cost, and registration fees.
- [ ] Whether the franchise (GP Brands) has a preferred or required platform.

### Rules any platform must follow (to check in detail before sending a single marketing text)

- [ ] **Register the business** with the carriers before texting (A2P 10DLC brand and campaign, or toll-free verification). Unregistered business texts get blocked.
- [ ] **Express written consent** for marketing texts (TCPA): an unticked box, the store named, frequency, "message and data rates may apply", STOP and HELP, not a condition of buying. The site's box already says all of that; the wording is in `site/src/lib/consent.ts`.
- [ ] **STOP, HELP and the other opt-out words** answered automatically, and honored right away.
- [ ] **Quiet hours:** no marketing texts at night (federal rule is 8 a.m. to 9 p.m. in the customer's time zone; some states are stricter).
- [ ] **Louisiana's own rules** on telephone solicitation, and any state where many customers live.
- [ ] **What may not be texted** (carriers block some content).
- [ ] Keep the consent records for as long as the law requires (the site keeps them indefinitely).
- [ ] "Up to 4 messages a month" is in the consent wording: keep to it, or change the wording before sending more.

### Then

1. Pick the platform and open the account.
2. Register the store's texting (10DLC or toll-free).
3. Connect it: shipping texts through the site; marketing lists from customers who said yes (`marketing_consents`, newest choice per customer).
4. Write the first message and a calendar (ties in with the year-round shipping calendar, agenda item 19).

---

## P5. "Sign in with Google"

**Added:** 2026-11-14 14:54 CST. **Status:** later.

**What it is:** A "Sign in with Google" button next to the email and password sign-in. One tap creates or opens the account, with an email Google has already confirmed, so there's no confirmation email and no password. It eases sign-up, especially on phones. "Sign in with Apple" can follow the same way.

**Is it hard?** The code is about a day, and it can be built ahead and stay hidden until the keys are added. Most of the work is setup that only Peter (or William) can do, because it's done in the store's own Google account.

### What Peter has to do (about an hour, once)

- [ ] **The site's real web address** has to exist first: Google only sends people back to a registered address.
- [ ] **A privacy policy page** on the site (Google requires one; texting registration in P4 needs one too). Claude can draft it; it should be checked by whoever handles the store's legal questions.
- [ ] In **Google Cloud Console** (console.cloud.google.com), with the store's Google account: create a project, then **OAuth consent screen**: app name (Goin' Postal Forsythe), support email, logo, the site's address, the privacy policy link; ask only for the basic scopes (email, name).
- [ ] **Credentials → OAuth client ID** (type "Web application"), with the redirect address Claude gives (for example `https://<site>/api/auth/google`).
- [ ] Put the **Client ID** and **Client secret** into the site's secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Never paste the secret into a chat or a file in the repo.
- [ ] Publish the consent screen (basic email-and-name sign-in usually needs no Google review).

### What Claude builds

- [ ] The button on the Account page, the Ship page's sign-in prompt and the card review page.
- [ ] The sign-in flow with Google's security checks (state and nonce), matching the Google email to an existing customer, so counter customers keep their history.
- [ ] Tests, and a note in the edit log and meeting notes.

---

## P6. A fresher website theme

**Added:** 2026-11-14 15:19 CST. **Status:** ✅ done 2026-11-14 15:28 CST: Peter picked **B. Friendly & warm** (see EDIT-LOG.md).

**What it is:** Replace the site's 2000s look (glossy blue and tan gradients, bevelled tabs, Trebuchet) with a modern, easier-on-the-eyes theme in the logo's own colors: navy **#29276E**, flag red **#CB3833** and white. The Goin' Postal logo goes at the top left.

**The three directions** (Claude made a preview file with each as a mini home page; it's kept off GitHub because it contains the franchise logo):
- **A. Clean & bright:** white header, airy, Inter font, one red button per screen. Modern and trustworthy, like UPS or FedEx.
- **B. Friendly & warm:** rounded Nunito font, warm off-white, pill buttons, round icons. Welcoming, local.
- **C. Bold & proud:** a navy hero under a red-white-navy stripe, tall Barlow Condensed headlines like the store's print ads.

**The logo:** the file the franchise supplies (341 × 71 px), used as is, never redrawn or recolored. If franchise support has a bigger PNG or an SVG, it would look sharper on phones and laptops. It sits on a white header in every direction because its navy lettering needs a light background.

### Steps

- [ ] Peter picks A, B, C or a mix.
- [ ] (Optional) Ask franchise support for a larger logo file, and whether they have website brand rules.
- [ ] Claude applies the theme site-wide in one change (the colors, fonts, corners and shadows are tokens in `site/src/styles/global.css`), with the logo in the header.
- [ ] Tidy the header: language and text size into a small top bar or menu, so the tracking box is on the first screen on phones (D13 in FOR-WILLIAM.md).
- [ ] Check every page on phone and computer, in all 14 languages, in High contrast mode and at the larger text sizes. Keep the staff counter pages readable.

---

## P7. Print & Promo online: the e-commerce side, first

**Added:** 2026-11-14 18:59 CST. **Status:** next. **Peter's decision:** start with the e-commerce side (business cards, t-shirts, banners, business pens, mailboxes), make money with it, and only later take the smaller, safer step of online shipping labels (P8).

**Why this first:** higher margins than a label; nobody price-shops a custom banner against Pirate Ship; it doesn't compete with the counter; every order is picked up in the store, which is a chance to sell more.

| Product | What exists | How it's ordered online |
|---|---|---|
| **Business cards** | ✅ Built: designer, review page, Stripe, pickup | Order and pay now |
| **Banners and yard signs** | The card designer can draw any size | Design online or upload a file, see the price, pay, pick up |
| **T-shirts** | Plan with local partner printers in `monetization/screen-printing/` (Atomic Ink, West Monroe, about 4 miles) | **Request a quote**: upload the design, colors, sizes and quantity; staff price it; the customer pays by a link |
| **Business pens and promo items** | Nothing yet | **Request a quote**: pick the item, upload a logo, quantity; ordered from a promotional-products supplier and resold at a markup |
| **Mailboxes** | The agenda mentions an online sign-up (v1.47.0), not on the site now: ask William | **Reserve online, finish at the counter** (the USPS form and two IDs have to be done in person) |

### Build order

- [x] **1. Online labels off with a switch, before the site goes live** (see P8): the Ship page becomes "Get a quote, then pay at the counter", or leaves the menu. Nothing is deleted. ✅ 2026-11-14 19:15 CST: staff **Settings** page, owner PIN only, audited, starts Off. Off = reserve online, pay at the counter. **Changed 2026-11-14 19:42 CST:** Off now means no shipping prices on the website at all; the Ship page becomes "Ship with us in the store" and the home page talks about the counter.
- [x] **2. A "Print & Promo" section** in the menu: one page with every product, photos of real work, and a button each. ✅ 2026-11-14 20:07 CST: named **Printing** (Peter), a dropdown with Business Cards, Banners & Yard Signs, Custom T-Shirts, Pens & Promo Items and "See all printing"; a page per product. Still to add: **photos of real work** on the tiles.
- [x] **2b. Business card shop page**, like an online print shop (Peter): papers, finishes, corners, designs by type of business, Upload your design. ✅ 2026-11-14 20:24 CST.
- [x] **2c. Card editor screen**, like Vistaprint's: tool bar on the left (Designs, Text, Uploads, Background), the card big in the middle, Front and Back pictures on the right, zoom, the price and Next at the top, Next to a separate options step. ✅ 2026-11-15 12:03 CST. **Save to my account** ✅ 11:51. Still to do: a starter set of **Graphics** (icons and shapes drawn by us) as a fifth tool, the **bleed** edge once the printer is picked (P9), and rounded corners drawn on the card while editing.
- [x] **2f. "Let us design it for you"**, a paid option (Peter): the link under the top bar and a Design choice in the options; notes required; staff get a DESIGN HELP banner. ✅ 2026-11-15 12:03 CST. Price $20 is a placeholder (P9). Later: staff send the proof through the site and the customer approves it online.
- [ ] **2d. Free sample pack** (Peter's idea from Vistaprint's free sample kit, 2026-11-14 20:24 CST): a low-commitment way to try the store. Ours can be **free to pick up at the counter** (no postage), which also brings people in. One card of each paper and finish we sell, in a small envelope or bag. Online: a "Get a free sample pack" button on the business card page that reserves one under the customer's account (with their marketing choice), and staff hand it over. Needs: the samples printed, and a limit (one per customer).
- [x] **2e. Saved designs on the account** (Peter): every business card a customer saves or orders is kept, with Edit, Reorder and Delete. ✅ 2026-11-15 11:51 CST. Built for every product: **t-shirts, banners, yard signs and pens and promo items save the same way** when steps 3 and 4 put them online (their quote or design is saved with `product` set, and Reorder fills in the last quantity and options).
- [ ] **3. Request a quote:** the customer's form (product, file upload, details, quantity), a staff page to price it and send a payment link, the order on the customer's account. One build covers t-shirts, pens and any future custom product.
- [ ] **4. Banners and yard signs** in the designer, priced by size.
- [x] **5. Mailbox reservation** online, finished at the counter. ✅ 2026-11-15 15:38 CST: reserve online, staff assign the box, **My mailbox** on the account, text and email reminders (a staff button for now, P12). Peter to confirm: medium 6 months (he wrote 7), the box ranges, the address format.

### To find out

- [ ] Does the store print banners in-house (wide-format printer), or send them out? Sizes and prices.
- [ ] Which promotional-products supplier for pens and promo items, and what markup.
- [ ] Which t-shirt partner, their minimums, turnaround and prices (see the screen-printing plan).
- [ ] Does the franchise have preferred print or promo vendors, or rules about them?
- [ ] Photos of real work for the product pages.
- [ ] **Business cards:** who prints them (store or outside shop); that sets the bleed size and file format for the editor. Real prices to replace William's placeholders ($24.99 / 100 up to $89.99 / 1,000; +$5 thick, +$8 linen, +$4 gloss, +$6 soft touch, +$6 rounded, +$10 rush, +$20 design help). Which extras the store can make: circle, oval or square shapes, plastic, foil, painted edges, magnetic cards, card holders.

---

## P8. Online shipping labels, later and on purpose

**Added:** 2026-11-14 18:59 CST. **Status:** on the sideline. Everything is built and stays in the code; it's just not offered until the owners decide.

**Peter's thinking:** online labels could pull local, price-sensitive customers (resellers, small businesses) away from the counter. But they also reach customers **nationwide** who would never walk in, which is new money. Start with Print & Promo (P7), then take this on as a safer, smaller risk.

### When it's time, do these first

- [ ] **Keep counter prices online**, and show local (Monroe-area) customers "No online fee at the counter, and we'll pack it": the 3.5% online fee already favors the counter.
- [ ] **Remove the "at or under Pirate Ship" line** on the rates, so the site doesn't invite price comparison.
- [ ] **Lead nationwide with business accounts** and the Shopify, eBay, Etsy and Square connectors (monthly billing, account discounts), not one-off retail labels. One-off price shoppers will compare against Pirate Ship's discounted rates.
- [ ] **Fraud protection:** Stripe's fraud screening on, spending limits for brand-new accounts (labels are a favorite target for stolen cards).
- [ ] **Weight-adjustment terms:** carriers bill the store's account when a package weighs more than declared; the terms must let the store charge the customer.
- [ ] **The franchise agreement:** does it allow selling labels online to customers outside the store's area?
- [ ] **Know the numbers:** the share of counter income from labels versus packing, boxes, printing and mailboxes, and how many customers walk in with prepaid labels.

---

## P9. Find a business card supplier, and price to compete

**Added:** 2026-11-15 11:28 CST. **Status:** next to research. **Peter's words:** "need to find a business card supplier. and understand their services and features they can provide. and getting prices to make sure we can be competitive."

**Why it matters:** the business card shop page and designer are built, but the prices on them are William's placeholders, and nobody has picked who prints the cards (D20). The supplier decides what the site can honestly offer (papers, finishes, shapes, extras), how fast, at what cost, and the file the designer has to produce.

### Steps

- [ ] **1. Make a short list.** Trade printers that sell only to print shops at wholesale and ship plain boxes with no printer's name (often called "blind" or "white label" shipping), plus a local Monroe or West Monroe printer, plus the option of printing in the store. Ask the franchise first: Goin' Postal may already have a preferred vendor or a negotiated price.
- [ ] **2. Ask each one the same questions:**
  - Papers and thicknesses (14 pt, 16 pt, 18 pt or more), linen, uncoated, recycled
  - Finishes: matte, gloss, soft touch, spot gloss or raised (embossed) gloss, foil
  - Shapes and extras: rounded corners, square, circle, oval, plastic, painted edges, magnetic cards, card holders
  - Quantities and price breaks (100, 250, 500, 1,000 and up), and the wholesale price for each paper and finish
  - Turnaround, a rush option, and the shipping time and cost to Monroe
  - File requirements: size, **bleed** (usually 1/8 inch), safe area, PDF or image, resolution, color (CMYK); the designer has to match these
  - How orders are placed (a website, email or an API), minimum order, payment terms, and what happens with a misprint
  - A free **sample pack** of their papers and finishes, for the counter and for our own sample pack (P7 2d)
- [ ] **3. Compare with what customers pay elsewhere.** For 100, 250, 500 and 1,000 cards on each paper and finish: Vistaprint (from Peter's screenshots: from about $10 to $19 for 100 standard, $18.99 premium, $27.99 deluxe; rounded corners from $22.99; often with coupon codes), MOO, the office-supply stores' print centers, and local print shops. Write the date next to every price; they change often.
- [ ] **4. Set our prices.** Supplier cost + shipping + the store's margin, checked against step 3. We don't have to be the cheapest: pickup with no shipping wait, a person checking every card, and local help are worth something. Pick where to be close on price (100 standard cards, the price people compare) and where to earn more (thick, soft touch, rush).
- [ ] **5. Put it on the site.** Update the prices and options in `site/src/lib/cards.ts` (the shop page and checkout both read from it), add any new papers, finishes or shapes the supplier offers, set the designer's bleed to the supplier's, and mark D20 decided.

### Questions for Peter, William and Rin

1. Print in the store, use a trade printer, or both (in-store for rush, the printer for the fancy options)?
2. What margin should business cards make?
3. Does the franchise agreement say anything about which printers the store can use?

---

## P10. Is real AI design worth about 2 cents a try?

**Added:** 2026-11-15 12:26 CST. **Status:** decide later. **Peter's words:** "lets just see it in action first and we can decide later. put that in the to do list to see if its worth spending 2 cents per ai use."

**What's built:** "Design with AI" in the card editor (the AI design tool, and a button on the first step). Right now it runs in **demo mode**: no AI and no cost. It matches words in the customer's request (business type, colors, a name in quotes) to pick three of our designs, and tells the customer it's a demo. Adding a key switches the same button to Claude, Anthropic's AI, which reads the request properly and writes the wording. The AI only picks from the store's own layouts, colors, patterns and icons; nothing else it says is used.

**Cost:** about **2 cents a try** with Claude Opus 5.5 (the default; a short request and a short answer). 100 customers trying 3 designs each comes to about $6. A cheaper model is possible if quality holds up. Limits built in: sign-in required, **10 tries per customer per day** (the `AI_DAILY_LIMIT` setting), plus the monthly spending limit set in the Anthropic console.

### Steps

- [ ] **1. Try the demo** with Rin and a few real customers: does "describe it and get designs" help people start?
- [ ] **2. Decide** whether it's worth about 2 cents a try, and the monthly cap (for example $20).
- [ ] **3. If yes:** create the store's account at console.anthropic.com, set the monthly spending limit there, and add the key to the live site's settings as `ANTHROPIC_API_KEY` (like the Stripe key; never in the code). Locally it goes in `site/.dev.vars`.
- [ ] **4. Try real AI** on a dozen sample requests before turning it on for customers, and compare it with demo mode.
- [ ] **5. Add a line to the privacy policy:** the customer's description is sent to an AI service to make designs.
- [ ] **Later:** "make it more elegant / try warmer colors" follow-ups, and AI wording suggestions in the Text panel.

---

## P14. Raise mailbox prices $2 to $5 each

**Added:** 2026-11-15 15:42 CST. **Status:** Peter hasn't picked the numbers yet. **Peter:** "raise my prices like 2-5 bucks each".

Today's prices, as Peter gave them on Nov 15:

| Size | 6 months | 1 year |
|---|---|---|
| Small (#1100–1220) | $90 | $180 |
| Medium (#1221–1284) | $120 | $240 |
| Large (#1300–1323) | $180 | $360 |

- [ ] **Pick the new prices** (each up $2 to $5). Worth a look first: what nearby UPS Stores, other shipping stores and the post office charge for a box in Monroe, so the new prices still compete.
- [ ] Decide **who gets the new price**: new customers only, or everyone at their next renewal (and how much notice to give current holders; the renewal reminder text could say it).
- [ ] **Change the website:** one file, `site/src/data/mailboxes.json` (`price6` and `price12` per size). The Mailboxes page, reservations and staff page all read it.
- [ ] **Change William's register** too: the Prices tab in the mailbox register (`physical-mailbox/`), so the counter charges the same as the website.
- [ ] Update the price sign at the counter and the printed intake packet.

## P13. Virtual mail on the website

**Added:** 2026-11-15 15:42 CST. **Status:** later. **Peter:** "add to my to do list for virtual mail".

What we have today: the store's **virtual mailboxes run on Anytime Mailbox**, separate from the wall boxes (William, Nov 7: "virtual and physical boxes stay separate"; see [physical-mailbox/README.md](../physical-mailbox/README.md#virtual-mailboxes-stay-on-anytime-mailbox)). The website's new Mailboxes page only covers wall boxes.

Virtual mail means the customer gets our street address, we receive their mail, scan the envelope, and they choose online: open and scan, forward, shred, or hold for pickup. It suits people who travel, live out of town, or run a business from home.

- [ ] **Decide the plan:** keep selling it through Anytime Mailbox (they handle the app and scans; we get a share), or run it ourselves on the website later.
- [ ] **Prices:** what we charge now on Anytime Mailbox, and what a monthly plan should cost next to iPostal1, Anytime Mailbox's other stores and the UPS Store.
- [ ] **On the website now (small step):** a "Virtual mailbox" card on the Mailboxes page that explains it and links to our Anytime Mailbox sign-up page.
- [ ] **Later (bigger step), if we run it ourselves:** a "My mail" list on the account with the envelope scans and Open / Forward / Shred / Pick up buttons, a staff page to scan and upload, monthly billing (Stripe), and a text or email when mail arrives. Needs a scanner at the counter and the online USPS Form 1583 with a notary (USPS rules for virtual mail).
- [ ] Ask William how many virtual customers we have and what they pay.

## P12. Automatic mailbox reminders

**Added:** 2026-11-15 15:38 CST. **Status:** next for mailboxes. Today the reminders (30 days, 7 days, the day after it expires) go out when staff press **Send due reminders** on Counter → Mailboxes. Each goes once, so pressing it every morning is safe.

- [ ] A daily **scheduled job** on Cloudflare (a Cron Trigger) that does the same thing at, say, 10 am, so nobody has to remember. William's site has no scheduled jobs yet, so this is a small piece of new setup (D25).
- [ ] Real texts need the Twilio keys and real emails need the Resend key (P4); until then they're logged, not sent.
- [ ] Peter's revision pass on the Mailboxes page, the staff page and My mailbox.
- [ ] Later: renew and pay online (Stripe), so a holder can renew from the reminder link.
- [ ] Bring in the boxes already rented: they're in William's register (`physical-mailbox/`); staff can assign each to the holder's account by hand, or a one-time import.

## P11. Official carrier logos (USPS, UPS, FedEx, DHL)

**Added:** 2026-11-15 14:42 CST. **Status:** the site is ready; waiting on the files. The four carriers show as name badges in the header, the tracking box, the Ship page and the footer.

**Why it needs the official files:** the carrier logos are trademarks. They can be used only as supplied and under each carrier's brand rules, which usually come with being an authorized retail location. Redrawn or recolored logos aren't allowed (same rule as the Goin' Postal logo).

### Steps

- [x] ✅ 2026-11-15 14:51 CST (files supplied). **1. Ask Goin' Postal corporate** whether the franchise provides carrier logo files and the rules for using them online. Most franchise stores are authorized locations for several carriers.
- [x] ✅ 2026-11-15 14:45 CST: authorized for all four (Peter); the site now says "Authorized for". **2. Confirm the store's status with each carrier**, and the exact name for it: UPS (Authorized Shipping Outlet), FedEx (Authorized ShipCenter), USPS (Approved Postal Provider), DHL (Authorized Service Point). Each program has its own logo kit and rules.
- [x] ✅ 2026-11-15 14:51 CST: Peter supplied all four plus the DHL CIS badge. **3. Put each file in `site/public/brand/carriers/`** (SVG is best, PNG is fine) and set its `logo` in `site/src/data/carriers.ts`. That carrier's badge becomes its logo everywhere at once.
- [x] ✅ 2026-11-15 14:45 CST. **4. Once confirmed, the wording can say "Authorized"** for that carrier (for example "UPS Authorized Shipping Outlet"); until then it stays "We ship".

