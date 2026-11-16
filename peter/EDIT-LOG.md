# Peter's edit log

Every edit made for Peter, newest first. Times are Central (the store's time zone). Each entry matches one commit on the `peter` branch. The layout is set in [CLAUDE.md](CLAUDE.md).

---

## 2026-11-15 15:42 CST · To-do: virtual mail, and raising mailbox prices

- **Asked for:** "add to my to do list for virtual mail. raise my prices like 2-5 bucks each.. i havent thought about a figure but put it to the list"
- **What changed:** Two new to-do items. **P13 Virtual mail on the website**: what we have now (Anytime Mailbox), a small first step (a card on the Mailboxes page linking to our Anytime Mailbox sign-up) and the bigger one (running it ourselves). **P14 Raise mailbox prices $2 to $5 each**: today's prices, the questions to decide (the figure, new customers only or at renewal), and the two places to change (the website's `mailboxes.json` and William's register). Prices are **not** changed yet.
- **Files:** [TODO.md](TODO.md)
- **How to check it:** open `peter/TODO.md` and look for P13 and P14.

## 2026-11-15 15:38 CST · Mailboxes on the website

- **Asked for:** "another function i want to add is for mailboxes", then the prices (small $90 / $180, medium $120 / $240, large $180 / $360 for 6 months / a year), the box numbers in the 1000s, "i want the customers who have an account on the website to be able to view their mailbox once i have assigned them their box", and "email and text them to remind them that their mailbox is expiring soon".
- **What changed:**
  - A new **Mailboxes** page (`/mailbox`, linked from Services): the three sizes and prices, what you get, what to bring (two IDs, USPS Form 1583, payment), and a sample address. A signed-in customer picks a size and 6 months or a year, sees the total, and presses **Reserve my mailbox**. They get a code like MR-ABCDE and pay at the counter.
  - A new staff page, **Counter → Mailboxes** (in every counter page's menu): free boxes per size, **reservations waiting** (type the box number, press Assign), **boxes on the website** with paid-through date and status, **+6 months / +1 year**, **Remind**, **Close**, and **Assign a box to an account** for customers who signed up at the counter.
  - The customer's **Account** page gets a **My mailbox** tab once a box is assigned: box number, status (Current, Renews soon, Expired), their full address with a Copy button, size, paid-through date and term.
  - **Reminders by text and email**: 30 days before, 7 days before, and the day after it expires, each sent once. For now staff press **Send due reminders** on the Mailboxes page once a day; making it automatic needs a scheduled job (TODO P12).
  - Prices, box ranges, the address format and the reminder days are in one file Peter can edit: `site/src/data/mailboxes.json`.
  - Every change (assign, renew, close, reminders) is in the audit log, and both new tables are in Export.
- **Assumed, please confirm:** medium is **6 months** for $120 (Peter wrote "7 months"); box numbers **#1100–1220 small, #1221–1284 medium, #1300–1323 large**; addresses read **1800 Forsythe Ave, Suite 2 #1230, Monroe, LA 71201**.
- **Fixed while testing:** the reminder code read the send functions' "mock mode" flag as "sent", so in real use it would have said "no phone"; and the staff page's section shared a name with the page layout and never showed.
- **Files:** [site/src/data/mailboxes.json](../site/src/data/mailboxes.json), [site/src/lib/mailbox.ts](../site/src/lib/mailbox.ts), [site/src/pages/api/mailbox.ts](../site/src/pages/api/mailbox.ts), [site/src/pages/mailbox.astro](../site/src/pages/mailbox.astro), [site/src/pages/counter/mailboxes.astro](../site/src/pages/counter/mailboxes.astro) (and the menu line in every counter page), [site/src/pages/account/index.astro](../site/src/pages/account/index.astro), [site/src/shipping/store.ts](../site/src/shipping/store.ts), [site/db/schema.sql](../site/db/schema.sql), [site/src/data/store.ts](../site/src/data/store.ts), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/src/i18n/staff3.ts](../site/src/i18n/staff3.ts), [site/src/styles/global.css](../site/src/styles/global.css), [site/tests/mailbox.test.ts](../site/tests/mailbox.test.ts), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then **`npm run db:local`** (new tables), then `npm run dev`. Sign in as a customer, open **Services → Mailboxes** (or `/mailbox`) and reserve one. Then open `/counter/mailboxes`, enter PIN 1234, type a box number like 1230 and press Assign. Back on **Account**, the **My mailbox** tab shows it. Reminder texts and emails show in the PowerShell window as `[mock sms]` and `[mock email]`.

## 2026-11-15 14:55 CST · Carrier logos in the Tracking page's box

- **Asked for:** "go in the tracking page. put the logo brands in that box as well"
- **What changed:** The **Tracking** page's "Track a package" box now shows **"Tracking numbers from"** with the USPS, UPS, FedEx and DHL logos under the Track button, the same as the home page's box.
- **Files:** [site/src/pages/track/index.astro](../site/src/pages/track/index.astro)
- **How to check it:** `git pull`, then `npm run dev`, and open **Tracking** in the menu.

## 2026-11-15 14:54 CST · The store's address beside the logo, instead of "Forsythe"

- **Asked for:** "change Forsythe to 'Monroe, LA'", then "or rather change it to '1800 Forsythe Ave, Suite 2, Monroe, LA 71201'"
- **What changed:** The red words beside the Goin' Postal logo at the top of every page now read **1800 Forsythe Ave, Suite 2, Monroe, LA 71201**. On a computer they sit beside the logo in two neat lines; on a phone they go under the logo so nothing overlaps the Log in button. Only the header changed: the store's name ("Goin' Postal Forsythe") stays the same on labels, receipts and page titles. The words come from a new store setting, `headerLabel`, so each store can set its own.
- **Files:** [site/src/data/store.ts](../site/src/data/store.ts), [site/stores/forsythe.json](../site/stores/forsythe.json), [site/src/layouts/Base.astro](../site/src/layouts/Base.astro), [site/src/styles/global.css](../site/src/styles/global.css), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`, and look at the top of any page on a computer and on a phone (or a narrow browser window).

## 2026-11-15 14:51 CST · Official carrier logos on the site

- **Asked for:** "Here's the logos to use.." (USPS, UPS, FedEx Authorized ShipCenter, DHL, and the DHL Express Certified International Specialist badge)
- **What changed:** The carrier name badges are now the **official logos** Peter supplied, everywhere they appear: next to "Authorized for" at the top of every page, under the tracking box, the big row on **Ship a package**, and the footer. The **DHL Certified International Specialist** badge shows in the big row on Ship a package. The files are used as supplied; the two DHL images only had their plain grey margin trimmed so they line up with the others.
- **Note:** the UPS file is small (56 × 67 pixels), so it can look a little soft on sharp screens. A larger copy from the UPS logo kit would be crisper; just send it and it replaces this one.
- **Files:** [site/public/brand/carriers/](../site/public/brand/carriers/) (the five logo files), [site/src/data/carriers.ts](../site/src/data/carriers.ts), [site/src/components/CarrierBadges.astro](../site/src/components/CarrierBadges.astro), [site/src/styles/global.css](../site/src/styles/global.css), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Look at the top of any page, the home page's tracking box, Ship a package, and the bottom of any page.

## 2026-11-15 14:45 CST · Carrier wording: "Authorized for"

- **Asked for:** "we are authorized for everything"
- **What changed:** The carrier wording now says the store is authorized: **"Authorized for USPS · UPS · FedEx · DHL"** in the header, **"Authorized for every major carrier"** on the Ship page, and **"Authorized shipping location for ..."** in the footer (the tracking box still says "Tracking numbers from"). In all 14 languages. It stays general rather than naming each carrier's program title, since each program words its title differently; the exact titles can come with the logo kits.
- **Why:** The store is an authorized location for all four carriers (Peter), which is a selling point.
- **Files:** [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/src/layouts/Base.astro](../site/src/layouts/Base.astro), [site/src/pages/ship/in-store.astro](../site/src/pages/ship/in-store.astro), [site/src/pages/ship/index.astro](../site/src/pages/ship/index.astro), [site/src/data/carriers.ts](../site/src/data/carriers.ts), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Look at the top and bottom of any page, and Ship a package.

## 2026-11-15 14:42 CST · Carrier branding: USPS, UPS, FedEx, DHL across the site

- **Asked for:** "add more branding for the providers we are partnered with such as ups/fedex/usps/dhl ... at the top of the page lined up at the white blank, maybe the tracking box, at the footnote possibly ... also in the 'Ship a package' tab. we need more branding in there"
- **What changed:** The four carriers now show in four places:
  - **Header:** "We ship USPS · UPS · FedEx · DHL" in the white space between the logo and Log in (on computers; hidden on phones so the header doesn't crowd).
  - **Tracking box:** "Tracking numbers from USPS · UPS · FedEx · DHL" under the Track button.
  - **Ship a package:** a big **"Every major carrier, at one counter"** row with the four carriers, near the top.
  - **Footer:** "We ship with USPS · UPS · FedEx · DHL" on every page.
- **Logos:** for now each carrier shows as its **name** in a clean badge. Their logos are trademarks, so only the **official files** can be used, as supplied and under each carrier's rules (usually for authorized retail locations). The site is ready for them: put the file in `site/public/brand/carriers/` and set it in `site/src/data/carriers.ts`, and that carrier's badge becomes its logo everywhere at once. The wording says "We ship", not "partner" or "authorized", until the store's status with each carrier is confirmed (to-do P11).
- **Why:** Seeing the carriers right away tells people this is where to ship.
- **Files:** [site/src/data/carriers.ts](../site/src/data/carriers.ts) (new), [site/src/components/CarrierBadges.astro](../site/src/components/CarrierBadges.astro) (new), [site/src/layouts/Base.astro](../site/src/layouts/Base.astro), [site/src/pages/index.astro](../site/src/pages/index.astro), [site/src/pages/ship/in-store.astro](../site/src/pages/ship/in-store.astro), [site/src/pages/ship/index.astro](../site/src/pages/ship/index.astro), [site/src/styles/global.css](../site/src/styles/global.css), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Look at the top of any page on a computer, the home page's tracking box, **Ship a package**, and the bottom of any page.

## 2026-11-15 13:19 CST · Deals and news boxes on the sign-up form (email pre-checked, texts not)

- **Asked for:** "let this be the area they can opt in to get text messages and emails.. and have them prechecked.. that way they'll just mindlessly click create account. and its up to them if they uncheck or leave it checked"
- **What changed:** The **Create a free account** form now has **Deals and news (optional)** under the mobile number:
  - **☑ Email me Goin' Postal deals and news** starts **checked**. The customer can untick it.
  - **☐ Text me Goin' Postal deals and news** starts **unchecked**. The customer ticks it.
  - Whatever they leave ticked is recorded on their account, with the exact wording they saw, once they confirm their email. It shows on their Profile tab, where they can change it anytime.
- **Why texts aren't pre-checked:** under the TCPA, a pre-checked box isn't consent for marketing texts, and fines are $500 to $1,500 per text. The phone carriers also reject texting-platform registrations (to-do P4) whose sign-up form pre-checks the text box. US email law (CAN-SPAM) allows a pre-checked email box, as long as every email has an unsubscribe link. To get more text sign-ups legally, offer a reason, for example "$5 off your next order" (Peter to decide).
- **Files:** [site/src/pages/account/index.astro](../site/src/pages/account/index.astro), [site/src/pages/api/account.ts](../site/src/pages/api/account.ts), [site/src/lib/session.ts](../site/src/lib/session.ts), [site/src/styles/global.css](../site/src/styles/global.css), [site/tests/account-signup.test.ts](../site/tests/account-signup.test.ts) (2 more tests), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Sign out, open http://localhost:4321/account, and create a test account. Then look at the **Profile** tab: the email box is ticked and the text box isn't, unless you ticked it.

## 2026-11-15 13:14 CST · Account page in tabs, mobile number at sign-up, card orders under My orders

- **Asked for:** "can we be more organized on this page ... having buttons at the top.. like having a profile page", "get their number right from the bat at signup", "maybe one of the buttons be 'My orders'", and whether designs should be kept separate by product or in one area.
- **What changed:**
  - **The account page has tabs across the top: Profile · My orders · My designs · Addresses**, plus **Business** for customers with a business account. One section shows at a time, and the address bar remembers which one, so old links (like "View all shipments" in the Tracking menu, which opens `#orders`) land on the right tab.
    - **Profile:** name, email, phone, password, and deals and news.
    - **My orders:** **business card orders** with their status (Not paid, Paid and being made, At the printer, Ready to pick up, Picked up), then shipping orders. Card orders didn't show on the account at all before.
    - **My designs:** **one place for every product**, with filter buttons (All, Business card, and later T-shirt, Banner, Yard sign, Promo item; only the ones with designs show) and a label on each design. Edit, Reorder and Delete as before.
    - **Addresses:** saved addresses and the add form.
  - **Sign-up now asks for a mobile number** (required, checked for 10 digits), with a note that it's for calls and texts about orders, not marketing unless they say yes. It's saved to the account when they confirm their email. Accounts made before this keep asking on their first purchase, as before.
  - **Fixed on phones:** once signed in, the "Hi, Peter" button could push the page sideways on a phone (on every page). It now fits, and a long name ends in "…".
  - In all 14 languages.
- **Why:** The one long page was hard to scan. Getting the phone number at sign-up means the store can call or text a customer about any order.
- **About older card orders:** only card orders placed from now on are listed under My orders (older ones weren't linked to an account).
- **Files:** [site/src/pages/account/index.astro](../site/src/pages/account/index.astro), [site/src/pages/api/account.ts](../site/src/pages/api/account.ts), [site/src/lib/session.ts](../site/src/lib/session.ts), [site/src/lib/cardOrders.ts](../site/src/lib/cardOrders.ts), [site/src/pages/api/cards.ts](../site/src/pages/api/cards.ts), [site/src/styles/global.css](../site/src/styles/global.css), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/tests/account-signup.test.ts](../site/tests/account-signup.test.ts) (new, 3 tests), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Open http://localhost:4321/account, sign out, and create a new test account: the mobile number is now asked for. Then click through the tabs, and order a business card to see it under **My orders**.

## 2026-11-15 12:26 CST · Editor tools like Vistaprint (Templates, Graphics, Background, More) and "Design with AI" in demo mode

- **Asked for:** "lets add more functions that is broken up similar to vista print" (Templates that stay in the editor, the Background panel with colors and patterns, the More menu with QR codes), "possibly allow people to use ai to come up a design", then "lets just see it in action first and we can decide later. put that in the to do list to see if its worth spending 2 cents per ai use".
- **What changed:** The editor's left tool bar now has seven tools:
  - **Templates:** every layout shown with the customer's own words, in any of the 12 color schemes. Click one and the card changes **without leaving the editor**. Typed words, uploaded logos, added graphics and the background pattern all come along. The font for the whole card is here too, plus "Start over from the full gallery".
  - **Text** and **Uploads:** as before.
  - **Graphics (new):** 24 icons (phone, email, website, location, star, heart, house, car, wrench, hammer, leaf, fork and knife, scissors, medical, coffee, camera, paw, music, truck, cart, briefcase, church cross, cake, check) and 8 shapes (circle, square, rounded box, ring, triangle, diamond, line, frame), in any color.
  - **Background (new look):** 16 curated colors, any custom color, and **10 patterns** (dots, stripes, diagonal, grid, waves, chevron, confetti, leaves, circles, crosshatch) in 6 color pairs, plus Remove pattern. Every icon, shape and pattern was **drawn for the store**, so nothing belongs to anyone else.
  - **AI design (new):** the customer describes their business and the look they want, and gets **three designs** to pick from, built only from our layouts, colors, patterns and icons. Each one opens as a fully editable card. There's also a "Describe your business and let AI design it" button on the first step.
  - **More (new):** **QR code**. Type a web address and a scannable QR code goes on the card (it checks that the address looks real).
  - **Selecting a picture no longer jumps to another panel**, so you can add several icons in a row.
- **AI: demo mode for now, no cost.** Without an AI key, "Design it for me" picks designs by matching words in the request (business type, colors, a name in quotes), and says plainly that it's a demo. When a key is added, the same button asks Claude (Anthropic's AI), at about 2 cents a request. Either way: **sign-in required, 10 tries per customer per day** (changeable), and the AI can only choose from our own pieces; anything else it says is thrown away.
- **Why:** More choices make the store feel like the place to go, and the AI is a step Vistaprint's editor doesn't offer this simply. Demo mode lets you try it before deciding to pay.
- **Files:** [site/src/lib/cardArt.ts](../site/src/lib/cardArt.ts) (new: patterns, icons, shapes), [site/src/lib/cardDesign.ts](../site/src/lib/cardDesign.ts) (new: template switching, AI designs, demo mode), [site/src/pages/api/card-ai.ts](../site/src/pages/api/card-ai.ts) (new), [site/src/pages/cards/design.astro](../site/src/pages/cards/design.astro), [site/src/env.d.ts](../site/src/env.d.ts), [site/.dev.vars.example](../site/.dev.vars.example), [site/package.json](../site/package.json) (the Anthropic library), [site/src/styles/global.css](../site/src/styles/global.css), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/tests/card-tools.test.ts](../site/tests/card-tools.test.ts) (new, 8 tests), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then **`npm install`** (a new library), then `npm run dev`. Sign in, open Business Cards, press **Describe your business and let AI design it**, and type something like *a fun card for my crawfish restaurant "Bayou Boil", red and gold*. Pick a design, then try Templates, Graphics, Background and More.

## 2026-11-15 12:03 CST · New card editor screen, and "Let us design it for you"

- **Asked for:** "Let us design it for you" from Vistaprint, "may be neat to have when people are customizing their business card as an additional charge ... towards the top of the page"; and "the buttons at the top are starting to look a little convoluting ... like as if its photoshop ... possibly a editor window with the function buttons on the left like how vistaprint does it and then it allows you to hit next at the top right".
- **What changed:**
  - **The designer is now an editor screen** instead of a row of buttons:
    - **A top bar:** "Business Cards", Undo, Redo, Save, then Preview, the **price** (it follows the options), and a red **Next** button at the top right.
    - **A tool bar down the left** with four tools, each opening its own panel next to it: **Designs** (change the layout, and the font for the whole card), **Text** (+ Add text), **Uploads** (logo or photo, or a finished design), and **Background** (the color of the side).
    - **When something on the card is clicked**, its settings (size, bold, color, and so on) appear in the panel under the tool.
    - **The card big in the middle**, with a "Safety area" tag, and **zoom** (− 100% +) underneath.
    - **Front and Back** as small pictures of each side on the right. Click one to switch sides.
    - **Next** goes to a separate **Choose your options** step (quantity, paper, finish, corners, timing, design), showing the card next to it, with **Back to the design**. The page heading only shows on the first step.
    - On a phone, the tools sit in a row across the top and everything stacks.
  - **"Let us design it for you (+$20.00)"** is a link just under the top bar, and a new **Design** choice in the options: "I'll design it myself" (included) or "Let us design it for you" (+$20.00). Choosing it explains what happens and asks the customer to write in the notes what they want (business name, details, colors, ideas, plus their logo in Uploads). Notes are required for it and can now be twice as long. On the review page, the box they tick says the store will design the cards and send a proof to approve before printing. **Staff see a big "DESIGN HELP" banner** on the counter card page, like the RUSH one.
  - **The $20 is a placeholder** like the other card prices; the real price is part of to-do P9.
  - In all 14 languages.
- **Why:** The editor was getting crowded. Now each button has a clear place, like the big print sites. Design help is extra money for the store from customers who don't want to design it themselves.
- **Files:** [site/src/pages/cards/design.astro](../site/src/pages/cards/design.astro), [site/src/lib/cards.ts](../site/src/lib/cards.ts) (the Design option), [site/src/pages/api/cards.ts](../site/src/pages/api/cards.ts), [site/src/pages/cards/review.astro](../site/src/pages/cards/review.astro), [site/src/pages/counter/card/[code].astro](../site/src/pages/counter/card/%5Bcode%5D.astro), [site/src/styles/global.css](../site/src/styles/global.css), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/src/i18n/staff3.ts](../site/src/i18n/staff3.ts), [site/tests/cards.test.ts](../site/tests/cards.test.ts), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Open Business Cards and pick a design. Try each tool on the left, click text on the card, switch Front and Back on the right, then press **Next**. Go back and click **Let us design it for you**.

## 2026-11-15 11:51 CST · Saved designs on the customer's account: edit, reorder (business cards now, every product later)

- **Asked for:** "once they make an account, they'll have their business card saved and they can still make edits to their previous card and make an order with that or just reorder the same one", then "along with t shirts, pens, banners and yard signs. same deal save their stuff"
- **What changed:**
  - **The account page has a new "Your saved designs" section.** Each saved business card shows its picture, its name, and either "Saved (date)" or "Last ordered (date): 250 cards · Gloss". It has three buttons:
    - **Edit** opens it in the designer, with the last quantity and options already ticked.
    - **Reorder** goes straight to Review your order with the same card, quantity and options, priced again at **today's** prices.
    - **Delete** asks first.
  - **Cards are saved two ways:** a new **Save to my account** button in the designer, and **automatically every time a card is ordered**. Editing a saved card and saving or ordering it updates that same card, so the list doesn't fill up with copies. A customer who isn't signed in is told to sign in, and their design waits on the page meanwhile.
  - **Built for every printed product.** T-shirts, banners, yard signs and pens and promo items use the same saved list once they can be ordered online (to-do P7). Until then the section says they're coming.
  - **Safety:** a customer can only ever see, change or delete their own designs. Up to 30 of each product per customer, and a design with too many huge pictures is refused with a clear message. A design that can't be saved never stops the order.
  - In all 14 languages.
- **Why:** Repeat orders are easy money. A customer who can reorder their cards in two clicks comes back to us instead of starting over somewhere else.
- **Files:** [site/db/schema.sql](../site/db/schema.sql) (new `saved_designs` table), [site/src/shipping/store.ts](../site/src/shipping/store.ts), [site/src/lib/savedCards.ts](../site/src/lib/savedCards.ts) (new), [site/src/pages/api/account.ts](../site/src/pages/api/account.ts), [site/src/pages/api/cards.ts](../site/src/pages/api/cards.ts), [site/src/pages/account/index.astro](../site/src/pages/account/index.astro), [site/src/pages/cards/design.astro](../site/src/pages/cards/design.astro), [site/src/pages/cards/review.astro](../site/src/pages/cards/review.astro), [site/src/styles/global.css](../site/src/styles/global.css), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/tests/saved-designs.test.ts](../site/tests/saved-designs.test.ts) (new, 4 tests), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then **`npm run db:local`** (new table), then `npm run dev`. Sign in, design a card, press **Save to my account**, then open **Account**: the card is under "Your saved designs". Try Edit, Reorder and Delete.

## 2026-11-15 11:28 CST · To-do P9: find a business card supplier and price to compete

- **Asked for:** "add to the to do list. need to find a business card supplier. and understand their services and features they can provide. and getting prices to make sure we can be competitive"
- **What changed:** Nothing on the website. A new to-do item, **P9**, with the steps: make a short list (trade printers with plain-box shipping, a local printer, printing in the store, and asking the franchise); a list of questions for each supplier (papers, finishes, shapes, price breaks, turnaround, file and bleed requirements, how to order, sample packs); comparing with Vistaprint and others; setting our prices; and putting them on the site. Linked from decision D20 in the meeting notes.
- **Why:** The card shop is built, but its prices are placeholders and nobody has picked a printer yet.
- **Files:** [TODO.md](TODO.md) (P9), [FOR-WILLIAM.md](FOR-WILLIAM.md) (D20)
- **How to check it:** Open `peter/TODO.md` and find P9.

## 2026-11-15 11:28 CST · Business cards: turn the card in 3D, with Front and Back buttons

- **Asked for:** "after the customer is done with their design that they can drag their card or flip their card around to check how their card looks digitally.. it gives a customer a professional and 'editorial' feel", and "it gives a front and back view option in the 3d card viewer".
- **What changed:**
  - **A 3D card** the customer can **drag to turn** with a mouse or a finger. **Front** and **Back** buttons under it turn it to face that side straight on, and the button for the side facing you lights up. The keyboard works too: arrow keys turn it, Enter flips it.
  - It shows what was picked: **gloss** has a shine that slides across as the card turns, **soft touch** a soft sheen, **linen** its weave, **thick** paper a thicker edge, and **rounded corners** are round.
  - It's on the **Review your order** page, above the flat front and back (those stay as the exact proof), and behind a new **Preview in 3D** button in the designer, which opens it in a window.
  - In all 14 languages.
- **Why:** It makes checking the card feel professional, like a big print shop, and helps people see the finish they're paying for.
- **Files:** [site/src/lib/card3d.ts](../site/src/lib/card3d.ts) (new: the 3D viewer), [site/src/pages/cards/review.astro](../site/src/pages/cards/review.astro), [site/src/pages/cards/design.astro](../site/src/pages/cards/design.astro), [site/src/styles/global.css](../site/src/styles/global.css), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Open Business Cards, pick a design, tick Gloss and Rounded corners, and press **Preview in 3D**. Drag the card, then press **Back** and **Front**. The same card is on the review page after **Review order**.

## 2026-11-14 20:24 CST · Business card shop page, like an online print shop, plus "Upload your design"

- **Asked for:** "once someone click business cards. it should start looking like a vistaprint website", with screenshots of Vistaprint's paper, shape, finish, business-use and editor sections; "allow people to feel they have options and feel this is the place to go". Who prints the cards is still open, and the prices stay as they are for now.
- **What changed:**
  - **Business Cards now opens a shop page** (`/cards`) built the way online print shops lay theirs out, in our own colors, words and pictures (every card picture is drawn from the site's own designs; nothing of Vistaprint's is copied):
    - a top banner, "Business cards, printed here in Monroe", **From $24.99 · $0.25 each / 100 cards**, with **Browse designs** and **Upload your design** buttons, and a fanned stack of sample cards;
    - four reasons to order here: pick up in the store, a real person checks every card, next-day rush, local help;
    - **Pick your paper**: Standard, Thick and Linen, each with its "From" price;
    - **Compare finishes**: Matte, Gloss and Soft touch tabs with what each is like and its price;
    - **Square or rounded corners**;
    - **Designs for your type of business**: Restaurant & Food, Beauty & Salon, Construction & Trades, Real Estate, Auto & Repair, Lawn & Landscaping, Church & Nonprofit, Medical & Health (each opens the designs in that business's colors and with matching sample wording), plus "See every design" and "Already have a design?";
    - **How it works** in three steps.
  - **Every price on the page comes from the same price list the checkout charges**, so the page can't show a price that's different from the bill. Only what the store sells today is shown.
  - **The designer moved to `/cards/design`.** Clicking a paper, finish or corner on the shop page opens it with that option already ticked in the order form.
  - **New: Upload your design.** Someone with a finished card from their own designer starts from a blank card and presses **Upload your design** (or **Upload a finished design** in the toolbar). The picture fills the card and is sized for printing. If it's too small to print sharply, or the wrong shape so the edges get trimmed, they're warned in plain words. A card that is only an uploaded picture can now be ordered (before, the front had to have text).
  - **Fixed:** "Payment was cancelled" never showed after someone backed out of the card payment, because that page was built once ahead of time. It's now built on each visit.
  - Everything is in all 14 languages.
- **Why:** So the store feels like the place to go for business cards: lots of options, clear prices, and the local advantages a big website can't offer.
- **Files:** [site/src/pages/cards/index.astro](../site/src/pages/cards/index.astro) (new shop page), [site/src/pages/cards/design.astro](../site/src/pages/cards/design.astro) (the designer, moved from `cards/index.astro`), [site/src/lib/cardShop.ts](../site/src/lib/cardShop.ts) (new: business types and "From" prices), [site/src/pages/cards/review.astro](../site/src/pages/cards/review.astro), [site/src/lib/stripe.ts](../site/src/lib/stripe.ts), [site/src/styles/global.css](../site/src/styles/global.css), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/tests/card-shop.test.ts](../site/tests/card-shop.test.ts) (new, 3 tests), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Open **Printing → Business Cards**. Click the Gloss tab, a paper, and a business type. Then try **Upload your design** with any picture from your computer.

## 2026-11-14 20:07 CST · "Printing" menu with a dropdown, and a page for each product

- **Asked for:** "lets do 'Printing' and then have a drop down menu for: Business Cards, Banners & Yard Signs, Custom T-Shirts, Pens & Promo Items, maybe have See all printing at the top of the dropdown menu or bottom"
- **What changed:**
  - The **Business cards** tab is now **Printing ▾**. Its dropdown lists **Business Cards, Banners & Yard Signs, Custom T-Shirts, Pens & Promo Items**, then a line, then **See all printing** at the bottom. It works like the Tracking menu: it opens on hover on a computer and with the ▾ arrow on a phone.
  - **New page "Printing"** (See all printing): a tile for each product. Business Cards is marked **Order online** with a "Design your cards" button. The other three are marked **Order in the store**, each with "Learn more".
  - **New pages for Banners & Yard Signs, Custom T-Shirts and Pens & Promo Items**: what it's for, how it works (tell us what you need, we send a price and a proof, pick it up), "Online ordering is coming soon", a **Call us** button and a **Send us a message** button, plus the store's hours. These pages will get the online "request a quote" form later (to-do P7 step 3).
  - **Fixed on phones:** the whole site was secretly about 1,000 pixels wide on a phone, so phones shrank the page to fit. That was caused by the menu bar and the language/text-size bar from the Theme B work. Pages now fit the screen exactly, and on a phone a dropdown opens as a full-width panel right under the menu bar.
  - Everything is in all 14 languages.
- **Why:** So visitors see right away that the store does printing, not just shipping, using the same "Shipping · Printing · Office Services" words as the franchise logo.
- **Files:** [site/src/layouts/Base.astro](../site/src/layouts/Base.astro) (the menu), [site/src/pages/printing/index.astro](../site/src/pages/printing/index.astro), [banners.astro](../site/src/pages/printing/banners.astro), [t-shirts.astro](../site/src/pages/printing/t-shirts.astro), [promo.astro](../site/src/pages/printing/promo.astro) (all new), [site/src/components/PrintProduct.astro](../site/src/components/PrintProduct.astro) (new, the shared layout of the three product pages), [site/src/styles/global.css](../site/src/styles/global.css), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** `git pull`, then `npm run dev`. Hover **Printing** in the menu, then click each item. On a phone, or with the browser window made narrow, tap the ▾ next to Printing.

## 2026-11-14 19:42 CST · Switch Off now means no shipping prices online at all

- **Asked for:** "I think the way I want the switch to work is basically not even give them quotes on the website."
- **What changed:** The Settings switch is now called **Online shipping: prices and labels**. When it's **Off** (as it is now):
  - The **Ship a package** page no longer has the price form. It shows **"Ship with us in the store"**: what we do for you (every carrier, packing, insurance and signature, a receipt with tracking), the address, phone and hours, a **Get directions** button and **Track a package**.
  - The **home page** headline says **"Every carrier, one counter."** with in-store steps (bring your package, we compare every carrier, we print the label) instead of "buy your label online".
  - The website's price lookup **refuses customers** and only answers staff PINs, so prices can't be pulled from the site some other way. Online orders are refused too.
  - **Staff quotes on the Queue page still work**, because the Queue sends your PIN.
  - The "reserve online, pay at the counter" idea from the last entry is gone, because there are no online prices to reserve.
  - When it's **On**, everything is back to William's online shipping with one click.
- **Why:** Peter wants shipping to bring people into the store, not give prices away online.
- **Files:** [site/src/pages/ship/in-store.astro](../site/src/pages/ship/in-store.astro) (new), [site/src/pages/ship/index.astro](../site/src/pages/ship/index.astro), [site/src/pages/index.astro](../site/src/pages/index.astro), [site/src/pages/api/rates.ts](../site/src/pages/api/rates.ts), [site/src/pages/api/orders.ts](../site/src/pages/api/orders.ts), [site/src/pages/counter/queue.astro](../site/src/pages/counter/queue.astro), [site/src/pages/counter/settings.astro](../site/src/pages/counter/settings.astro), [site/src/pages/api/settings.ts](../site/src/pages/api/settings.ts), [site/src/lib/siteSettings.ts](../site/src/lib/siteSettings.ts), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/src/i18n/staff3.ts](../site/src/i18n/staff3.ts), [site/tests/site-settings.test.ts](../site/tests/site-settings.test.ts) (9 tests now), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** First `git pull`, then `npm run dev`. Open http://localhost:4321/ship: it says "Ship with us in the store". The home page headline says "Every carrier, one counter." Turn it On at /counter/settings with the owner PIN and both go back to online shipping.

## 2026-11-14 19:15 CST · Online label buying: an on/off switch for the owners

- **Asked for:** "where or how should we do a online labels with a switch? a admin login to switch it off?" (P7 step 1)
- **What changed:** A new staff page, **Settings**, in the staff menu on every staff page. It has one switch: **Online label buying, On or Off**. Anyone on staff can see it with their PIN, but only an **owner PIN** can flip it, it asks "are you sure?" first, and every change is written in the staff audit log with the name and time. It starts **Off**.
  - **When Off** (now): customers still compare USPS, UPS, FedEx and DHL prices on the Ship page, but the button says **"Reserve, pay at the counter"**. They get a pickup code and QR code, there is no online card payment and no online convenience fee, and the order shows up in the **Queue** like a walk-up, where staff press "Rung up. Buy label" after taking payment on the register.
  - **When On**: everything works as William built it: pay by card through Stripe and print at home.
  - Business cards are not affected; they are always paid online.
- **Why:** Peter's decision (D19): e-commerce first, online labels on the sideline. This keeps people coming into the store for labels, while the Ship page still shows prices and brings them in. When the time comes, an owner turns it on with one click, nothing to rebuild.
- **Files:** [site/src/pages/counter/settings.astro](../site/src/pages/counter/settings.astro) (new page), [site/src/pages/api/settings.ts](../site/src/pages/api/settings.ts) (new), [site/src/lib/siteSettings.ts](../site/src/lib/siteSettings.ts) (new), [site/src/shipping/store.ts](../site/src/shipping/store.ts), [site/db/schema.sql](../site/db/schema.sql) (new `site_settings` table), [site/src/pages/api/orders.ts](../site/src/pages/api/orders.ts), [site/src/pages/api/rates.ts](../site/src/pages/api/rates.ts), [site/src/pages/ship/index.astro](../site/src/pages/ship/index.astro), [site/src/pages/ship/done.astro](../site/src/pages/ship/done.astro), the staff menu line in every page in [site/src/pages/counter/](../site/src/pages/counter/), [site/src/i18n/strings.ts](../site/src/i18n/strings.ts), [site/src/i18n/staff3.ts](../site/src/i18n/staff3.ts), [site/src/styles/global.css](../site/src/styles/global.css), [site/tests/site-settings.test.ts](../site/tests/site-settings.test.ts) (new, 6 tests), [TODO.md](TODO.md), [FOR-WILLIAM.md](FOR-WILLIAM.md)
- **How to check it:** First `git pull`, then `npm run db:local` (new table), then `npm run dev`. Open http://localhost:4321/counter/settings, type a PIN and press Show. To flip it locally, put a number after `OWNER_PIN=` in `site/.dev.vars` (for example `OWNER_PIN=9999`) and restart. Then try the Ship page: with the switch Off the last button says "Reserve, pay at the counter" and you land on the pickup-code page; the order is in /counter/queue.

## 2026-11-14 18:59 CST · Decision: e-commerce first, online labels on the sideline

- **Asked for:** Peter's input: online labels might pull price-sensitive local customers away from the counter, though they also reach customers nationwide; "I'd rather do the e-commerce side, make money with that, and then slowly take risks like selling shipping labels."
- **What changed:** Nothing on the website. Added **P7** (Print & Promo online: business cards, banners and yard signs, t-shirts, business pens and promo items, mailboxes; build order and questions) and **P8** (online labels, later, with the checks to do first) to the to-do list, and **D19** to the meeting notes.
- **Why:** Higher margins, no price shopping, no competition with the counter, and pickups bring people in. Labels come later, on purpose.
- **Files:** [TODO.md](TODO.md) (P7, P8), [FOR-WILLIAM.md](FOR-WILLIAM.md) (D19)

## 2026-11-14 15:39 CST · Store hours and phone number

- **Asked for:** "Change my hours to 9 AM to 6:30 PM Monday to Friday, Saturdays 9 am to 3 pm and Sundays 10 am to 3 pm. And my store phone number is (318) 570-2132."
- **What changed:**
  - **Hours:** Monday to Friday 9:00 am to 6:30 pm; Saturday 9:00 am to 3:00 pm; Sunday 10:00 am to 3:00 pm (Sunday was "Closed").
  - **Phone:** (318) 570-2132 (was the placeholder (318) 000-0000). It shows wherever the site lists the store's phone, and it's now the store's contact number on shipping labels (+1 318 570 2132), which carriers use if there's a problem with a package.
  - The same facts in `site/stores/forsythe.json`, the template for the next store.
- **Not changed:** the printed counter flyer leaves blank HOURS and PHONE lines to fill in by hand; the business-card designer's sample card keeps its made-up number.
- **Files:** [store facts](../site/src/data/store.ts), [store file](../site/stores/forsythe.json)
- **How to check it:** `git pull`, refresh the home page: "Hours and directions" in the right column shows the new hours and phone. The Contact page shows them too.
- **Checks run:** 166 tests pass, the site builds, and the built home and contact pages show the new hours and phone.

## 2026-11-14 15:28 CST · New look: Theme B, Friendly & warm, with the Goin' Postal logo

- **Asked for:** "Let's do B" (from the three theme ideas), with the company logo at the top left. The logo is the file the franchise supplies.
- **What changed (every page, staff pages included):**
  - **Colors from the logo:** navy #29276E and flag red #CB3833 on a warm off-white page, instead of the glossy blue and tan.
  - **Font:** Nunito, a rounded, friendly face, served from the store's own site (not Google's servers). Lao, Khmer, Thai, Korean, Chinese and Japanese keep the fonts that carry their letters.
  - **Header:** white, with the **Goin' Postal logo** top left and "Forsythe" beside it, the menu in navy ("Ship a package" as a red pill, the current page underlined in red), the Tracking dropdown as a soft card, and the red **Log in** pill on the right.
  - **A slim bar above the header** holds the language picker, text size and High contrast, like ups.com. It stays small whatever text size is picked.
  - **Buttons** are flat pill shapes: red for the main action, navy for the other. **Cards, boxes and fields** are white with soft shadows and rounded corners. Headings are navy.
  - **On a phone:** the menu scrolls sideways on one line and the top bar stays on one line, so the tracking box now starts on the first screen (192 px down an 844 px screen). That settles D13.
  - **High contrast** still turns everything flat black and white with bold outlines.
- **The logo:** `site/public/brand/goin-postal-logo.png`, the franchise's file used as is (never redrawn or recolored). It's in the public GitHub repo because the site has to serve it; the footer already says Goin' Postal's name and logo belong to GP Brands. A larger PNG or an SVG from franchise support would look sharper.
- **New package:** the Nunito font (`@fontsource-variable/nunito`). After `git pull`, run `npm install` once.
- **Files:** [layout and header](../site/src/layouts/Base.astro), [styles](../site/src/styles/global.css) (a Theme B section at the end), [logo](../site/public/brand/goin-postal-logo.png), [package list](../site/package.json)
- **How to check it:** `git pull`, then `npm install`, then `npm run dev`, and open http://localhost:4321. Try the Ship page, Tracking, Business cards, Account, a phone-sized window, another language and High contrast.
- **Checks run:** 166 tests pass, the type check is clean, the site builds. Screenshots of the home, Ship, Tracking, Business cards, Account and staff Queue pages on a computer, the home and Ship pages on a phone, the Tracking menu, High contrast, Lao and Chinese; no page scrolls sideways; the font loads. The sign-up and sign-in journey from the Ship page ran again on the new theme.
- **Fixed while checking:** "Ship a package" lost its pill (and went white on white on the Ship page) because an older rule won; the "PeterShip" title kept a faint mirror reflection from the old look; the top bar grew to three rows on a phone at larger text sizes.

## 2026-11-14 15:19 CST · Theme ideas and to-do P6

- **Asked for:** help getting started on "a better website theme, something more friendly to the eyes and not so old styling", with the company logo at the top left. The logo is the file the franchise supplies.
- **What changed:** Nothing on the website yet. Claude made a preview with three directions (A. Clean & bright, B. Friendly & warm, C. Bold & proud), each a mini home page with the logo, in the logo's navy and red, plus a comparison and the steps. Added **P6** to the to-do list and **D18** to the meeting notes. The preview file isn't in the repo because it contains the franchise logo (the repo is public).
- **Why:** So Peter can pick a look before the whole site is restyled in one change.
- **Files:** [TODO.md](TODO.md) (P6), [FOR-WILLIAM.md](FOR-WILLIAM.md) (D18)

## 2026-11-14 14:54 CST · Passwords for customer accounts, with the email link kept as a backup

- **Asked for:** "Why is it 'email me a sign-in link'? They can't just put a password?" Peter picked: add passwords, keep the link for "forgot password". Also asked about "Sign in with Google" (added as P5 on the to-do list).
- **What changed:**
  - **The Account page** now has two boxes: **Sign in** (email and password, with "Forgot your password? Email me a sign-in link") and **Create a free account** (name, email, password).
  - **Creating an account** asks for a password, then sends one confirmation email; opening the link signs the customer in and brings them back to where they were (the Ship page with its form, or the card review page with the design). After that it's email and password every time.
  - **Existing customers** (from the counter or the old email-link sign-in) "create an account" with their usual email: the confirmation link adds the password to their existing account, so their history stays.
  - **Signed-in customers** can set or change their password on the Account page. **Forgot password:** the email link signs them in, then they set a new one.
  - **The Ship page and the card review page** now show **Sign in** and **Create an account** buttons (the form or design is kept on the device meanwhile).
  - All new and changed text in all 14 languages.
- **Security:**
  - Passwords are stored only as a one-way scrambled code (PBKDF2-SHA256, salted, 100,000 rounds), never as typed, and the staff export blanks those codes.
  - **A password only takes effect once the email is proven** (the confirmation link), so nobody can put a password on someone else's email and see their orders.
  - Five wrong passwords for an email (or thirty from one connection) lock sign-in for fifteen minutes; the message is the same whether the email exists or not; sign-ups from one connection are limited too.
  - Passwords need 8 or more characters and can't be one of the most common passwords or the email itself.
- **Before going live:** email (Resend) must be connected, since sign-up confirmation and "forgot password" use it. The new table needs the database setup re-run (`npm run db:local`, and `db:remote` on the live site).
- **Files:** [password helpers (new)](../site/src/lib/password.ts), [tests (new)](../site/tests/password.test.ts), [sign-in links and lockout](../site/src/lib/session.ts), [account API](../site/src/pages/api/account.ts), [account page](../site/src/pages/account/index.astro), [store](../site/src/shipping/store.ts), [database table](../site/db/schema.sql), [ship page](../site/src/pages/ship/index.astro), [card review page](../site/src/pages/cards/review.astro), [text, 14 languages](../site/src/i18n/strings.ts), [styles](../site/src/styles/global.css), [TODO.md](TODO.md) (P5)
- **How to check it:** `git pull`, `npm run db:local` (new table), `npm run dev`. Open **Log in**, create an account (the confirmation email prints in the PowerShell window; the page also shows a "dev: open it" link). Sign out from the Account page, then sign back in with the password.
- **Checks run:** 166 tests pass (6 new), the type check is clean, the site builds, the database setup runs twice cleanly. In a real browser: sign-up from the Ship page back to a filled-in form; a common password refused; wrong and right passwords; changing the password; the lockout on the sixth try even with the right password; an existing customer's new password doing nothing until their email link is opened, then working with their history kept; "forgot password" sending the link.

## 2026-11-14 14:41 CST · Log in button, and business cards: review page, secure payment, confirmation

- **Asked for:** "A login button on the far right top of the page, so it allows customers to immediately log in", so that once logged in they can use all the features, like business cards; and for business cards, "a second page like a secure payment section ... and a confirmation page for them to hit confirm order." Peter picked: a review page on our site, then Stripe's secure payment page; anyone can design, sign in to order.
- **What changed:**
  - **Log in button** at the top right of every page (gold, like the Ship a package tab). Signed out it says **Log in** and comes back to the same page after signing in. Signed in it says **Hi, Pat** (or **Account** until the customer has a name) and opens their account. Staff pages don't show it.
  - **Business cards, step by step:**
    1. **Design** as before. The name, email and phone boxes are gone from the designer (they come from the account). The button is now **Review order**.
    2. **Review your order** (new page): both sides of the card, the quantity and options, sales tax, the online fee and the total (priced by the server, so they match the charge), the pickup details from the account (name and phone asked here if the account doesn't have them yet), a required box "I checked the spelling, phone numbers and layout. The cards are printed exactly as shown.", and **Confirm and pay**. A line says payment is by Stripe and the store never sees the card number. Signed-out customers sign in right on this page; the design waits on their device while they open the email link.
    3. **Stripe's secure payment page** takes the card details.
    4. **The confirmation page** ("Paid. We are printing your cards.") with the pickup code and a QR to show at the counter.
  - **Ordering cards needs an account**, like buying labels. Designing is open to everyone.
  - All new text in all 14 languages.
- **Why the card form isn't on our own page:** card numbers that pass through the store's own site bring the full card-security rules (PCI) and the liability if they're ever stolen. Stripe's page keeps card numbers off the site entirely.
- **Files:** [header](../site/src/layouts/Base.astro), [account API](../site/src/pages/api/account.ts) (who is signed in), [card designer](../site/src/pages/cards/index.astro), [review page (new)](../site/src/pages/cards/review.astro), [card orders API](../site/src/pages/api/cards.ts), [text, 14 languages](../site/src/i18n/strings.ts), [styles](../site/src/styles/global.css)
- **How to check it:** `git pull`, `npm run dev`. See **Log in** at the top right. Open **Business cards**, pick a layout, click the sample name on the card and type yours, then **Review order**. Sign in from the review page (open the link printed in the PowerShell window or the "dev: open it" link), tick the box and press **Confirm and pay**. In demo mode the Stripe step is skipped and you land on the confirmation page.
- **Checks run:** 160 tests pass, the type check is clean, the site builds. In a real browser: the button's text and link signed out and signed in; the designer's Review order; the review page's server prices ($39.99 + $4.39 tax + $1.40 fee = $45.78 for 250 cards); sign-in from the review page with the design kept; Confirm blocked until the box is ticked; the confirmation page; the review page empty after ordering; ordering cards without an account refused.

## 2026-11-14 14:26 CST · Tracking page search made bigger and centered, like the home page

- **Asked for:** "In the tracking tab, can you make the track a code box bigger and centered like the front page of the website."
- **What changed:** The top of the tracking page now looks like the home page's tracking box: a centered white card with "Track a package", the short instructions, a wide search box, and the gold **Track** button beside it. The search box hint reads "Pickup code or tracking number" (instead of the sample code GP-7K3M9Q). The "not found" message and the "Track on UPS" style buttons appear centered under it. On a phone, the button sits under the box.
- **Why:** The same look on both pages, and a bigger box that's easier to use.
- **Files:** [tracking page](../site/src/pages/track/index.astro), [styles](../site/src/styles/global.css)
- **How to check it:** `git pull`, open http://localhost:4321/track.
- **Checks run:** the site builds. In a real browser: the box is centered on the page; a UPS number still offers "Track on UPS"; nonsense still says not found; no sideways scrolling on a phone.

## 2026-11-14 14:23 CST · State boxes say "State" instead of "LA"

- **Asked for:** "Instead of LA, I want 'State'."
- **What changed:** Both **State** boxes on the Ship page (return address and "Where is it going?") now show a grey "State" hint instead of "LA". It follows the language picker, like the rest of the page. The box still takes the two-letter state code, and the address dropdown and ZIP lookup still fill it in.
- **Why:** "LA" looked like it was already filled in.
- **Files:** [ship page](../site/src/pages/ship/index.astro)
- **How to check it:** `git pull`, open http://localhost:4321/ship: both State boxes read "State" in grey.
- **Checks run:** the site builds.

## 2026-11-14 14:22 CST · Sample address removed from the street boxes

- **Asked for:** "Remove the address in the address box."
- **What changed:** Both **Street address** boxes on the Ship page (return address and "Where is it going?") no longer show the grey sample "1800 Forsythe Ave, Monroe". They start empty. The address dropdown still works the same.
- **Why:** The store's own address as a sample could confuse customers into thinking it was already filled in.
- **Files:** [ship page](../site/src/pages/ship/index.astro)
- **How to check it:** `git pull`, open http://localhost:4321/ship: both street boxes are blank.
- **Checks run:** the site builds.

## 2026-11-14 14:13 CST · Tracking menu, recently tracked, accounts to buy, marketing consent

- **Asked for:** change the tab "Track" to "Tracking" with a dropdown like UPS's ("Track a shipment", "View all shipments"); a "recently tracked / save your tracking here" box that asks people to log in or sign up; "they can only create shipments when they have an account, so I can start email and SMS marketing once I collect their phone number and email"; and "add to the to-do list: find an SMS platform".
- **What changed:**
  - **"Track" is now "Tracking"** in the header (14 languages), with a dropdown: **Track a shipment** (the tracking page) and **View all shipments** (the orders on the customer's account). It opens on hover, with the keyboard, or with the ▾ arrow on a phone.
  - **Recently tracked** on the tracking page:
    - Signed out: "Save your tracking here", with **Sign in** and **Create an account**.
    - Signed in: the last 10 things they tracked (the store's codes and other carriers' numbers), newest first, plus a link to all their shipments.
  - **Buying a label online needs a free account.** Anyone can still get rates. At the pay step, a signed-out customer sees "Sign in to buy your label", types their email and gets a sign-in link. The whole form is kept on their device; the link brings them back to the Ship page with everything filled in and the rates showing. Sign-in and sign-up are the same link (no password).
  - **First purchase asks for a mobile number** ("for problems with this shipment"). The account takes its name from the return address.
  - **Marketing consent, done the legal way:** two **unticked** boxes, "Email me Goin' Postal deals and news" and "Text me Goin' Postal deals and news ... Up to 4 messages a month ... Reply STOP to stop, HELP for help. Agreeing is not a condition of buying." Each yes is logged with the exact wording, the language, the email or phone, where, and when. Customers can change either choice anytime on the **Account** page; that's logged too.
  - The staff counter and business accounts are unchanged: walk-ups don't need an account.
  - **To-do P4:** find a texting platform, with the registration and consent rules.
- **Problems found and fixed:**
  - **Every online order renamed the customer after the person receiving the package** (for example "Sam" instead of "Pat"), because online orders didn't carry the customer's own name. Fixed: they do now. (H9 in FOR-WILLIAM.)
  - The customer record's existing "consent" flags are switched on automatically for anyone with an email; they mean "receipts and tracking", not marketing. Marketing consent is now kept separately so nobody lands on a marketing list without saying yes. (H8.)
- **Before going live:**
  - **Email must be connected (Resend).** Buying now needs the sign-in email; without it nobody can buy online.
  - The two new tables need the database setup re-run: `npm run db:local` on each computer, `npm run db:remote` on the live site.
- **Files:** [header and menu](../site/src/layouts/Base.astro), [tracking page](../site/src/pages/track/index.astro), [tracking lookup](../site/src/pages/api/track.ts), [ship page](../site/src/pages/ship/index.astro), [orders](../site/src/pages/api/orders.ts), [account page](../site/src/pages/account/index.astro), [account API](../site/src/pages/api/account.ts), [sign-in return path](../site/src/lib/session.ts), [consent wording (new)](../site/src/lib/consent.ts), [store](../site/src/shipping/store.ts), [database tables](../site/db/schema.sql), [tests (new)](../site/tests/accounts-tracked.test.ts), [text, 14 languages](../site/src/i18n/strings.ts), [styles](../site/src/styles/global.css), [TODO.md](TODO.md) (P4)
- **How to check it:** `git pull`, then `npm run db:local` once (new tables), then `npm run dev`.
  1. Hover **Tracking** in the header: the two choices appear.
  2. Open the tracking page signed out: "Save your tracking here".
  3. On the Ship page, get rates and pick one: "Sign in to buy your label". Type an email and press the button. The terminal window prints the sign-in email; open its link (or the "dev: open it" link on the page). You're back on the Ship page, filled in, with rates.
  4. Pick a rate, type a mobile number, tick a marketing box if you like, and pay.
  5. On the Account page, see the choices; on the tracking page, see Recently tracked.
- **Checks run:** 160 tests pass (8 new: recently tracked, consent, the sign-in return path), the type check is clean, the site builds, and the database setup runs twice cleanly. The whole journey above was run in a real browser, including the order API refusing a signed-out buyer.

## 2026-11-14 13:51 CST · Links under the tracking box centered

- **Asked for:** "Can you center the words 'Ship a package, Hours and directions, Contact'."
- **What changed:** The three links under the home page's tracking box now sit centered under the box on every screen width. They were drifting left on wide screens, because the site keeps every paragraph to a comfortable reading width and that row was a paragraph; that row is now allowed the box's full width.
- **Why:** So the links line up under the search box, like the title and the box above them.
- **Files:** [styles](../site/src/styles/global.css)
- **How to check it:** `git pull`, open http://localhost:4321 on a wide window: the links sit centered under the Track box.
- **Checks run:** the site builds; measured in a browser at 1000, 1400 and 1920 pixels wide, the links' center matches the box's center each time.

## 2026-11-14 13:29 CST · "Track a package" box at the top of the home page

- **Asked for:** "The first thing I want customers to see is a 'track my shipment' box on the front page, for ease of use, kind of similar to how UPS does it on ups.com."
- **What changed:**
  - **A big "Track a package" box** is now the first thing on the home page, full width, above everything else: one box for the pickup code or tracking number, a **Track** button, and quick links under it (**Ship a package**, **Hours and directions**, **Contact**). Pressing Track opens the tracking page with the results already looked up. It works even without JavaScript, and in all 14 languages.
  - **Packages not shipped here:** before, a UPS or FedEx number from somewhere else just got "We could not find that." Now the tracking page recognizes the carrier from the number's shape and offers a **"Track on UPS"** (or USPS, FedEx, DHL) button that opens the carrier's own tracking page. A number that could belong to two carriers gets both buttons.
  - **Fixed:** the tracking page always showed an empty red error box, even with no error. Empty error lines are now hidden everywhere.
- **Why:** Tracking is the most common reason people visit a shipping store's site, so it's one step from the home page, and nobody gets stuck on "not found".
- **Files:** [home page](../site/src/pages/index.astro), [tracking page](../site/src/pages/track/index.astro), [carrier recognition (new)](../site/src/lib/carrierTrack.ts), [tests (new)](../site/tests/carrier-track.test.ts), [text, 14 languages](../site/src/i18n/strings.ts), [styles](../site/src/styles/global.css)
- **How to check it:** `git pull`, open http://localhost:4321. Type a pickup code from one of your test orders and press Track. Then try `1Z999AA10123456784`: a "Track on UPS" button appears.
- **Checks run:** 154 tests pass (7 new), the type check is clean, the site builds. In a real browser: the box is first on the page; a real pickup code shows its status; a UPS number not shipped here offers UPS's tracking; nonsense still says "not found"; on a phone there's no sideways scrolling.
- **Noticed, not changed:** on a phone, the site's header (menu, language, text size) fills the whole first screen, so the tracking box is just below it. That's William's header design: D13 in [FOR-WILLIAM.md](FOR-WILLIAM.md).

## 2026-11-14 13:08 CST · To-do: insurance terms, do's and don'ts, limits

- **Asked for:** "Let's add to the to-do list about insurance, like a disclaimer with do's and don'ts, how much we can actually insure, what is not insurable. I don't want to add it yet because we would have to look at all the regulations per carrier."
- **What changed:** Added **P3** to the to-do list: what the disclaimer should cover, why it's waiting, what the site does today, a research checklist to fill in for each carrier (limits, free cover, items never covered, lower-limit items, packing rules, proof, deadlines, who files), and the decisions after that. Also added as **D12** in the meeting notes for William. Nothing on the website changed.
- **Why:** So the insurance terms are written from each carrier's real rules, not guessed, before customers see them.
- **Files:** [TODO.md](TODO.md) (P3), [FOR-WILLIAM.md](FOR-WILLIAM.md) (D12)
- **How to check it:** On GitHub, open `peter/TODO.md` on the `peter` branch and scroll to P3.

## 2026-11-14 13:05 CST · "What's inside" only asked with insurance

- **Asked for:** "For the What's inside box near the insurance tickbox, let's only make that box pop up if they check the insurance tickbox, because that's the only time it matters."
- **What changed:**
  - **What's inside** moved from "What is it?" into the insurance box, under **Value in USD**. It's hidden until **Insure it for the full value** is ticked.
  - When insurance is ticked, it's required, along with the value: Get rates asks for both.
  - Without insurance, the contents aren't sent at all; carriers get "Merchandise" on the label, as they already did when it was left blank.
- **Why:** One less box for most customers. The contents matter for an insurance claim, so they're asked exactly then.
- **Files:** [ship page](../site/src/pages/ship/index.astro)
- **How to check it:** `git pull`, open http://localhost:4321/ship. No "What's inside" box at first. Tick **Insure it for the full value**: Value in USD and What's inside appear. Untick it: both disappear.
- **Checks run:** 147 tests pass, the site builds. In a real browser: hidden at first, shown and required with insurance, sent only with insurance, hidden and not sent again after unticking.

## 2026-11-14 13:00 CST · Packaging picker with pictures on the Ship page

- **Asked for:** a packaging choice like Pirate Ship's (USPS flat rate boxes and envelopes, UPS Express packaging), with pictures so customers see what they're shipping in. "Use the photos I have for now, and draw the ones for FedEx."
- **What changed:**
  - **A "Packaging" picker** at the top of "What is it?". It shows the current choice with its picture; **Change** opens the full list with pictures, in four groups:
    - **Your own packaging:** envelope or soft pack, box (the default), tube or irregular.
    - **USPS:** Small, Medium and Large Flat Rate boxes; Flat Rate, Legal and Padded envelopes; Priority Mail Express, Legal and Padded envelopes.
    - **UPS:** Express Envelope, Small, Medium and Large Express Box, Express Tube, Express Pak.
    - **FedEx:** Envelope, Pak, Small, Medium, Large and Extra Large Box, Tube.
  - **Carrier packaging fills in its own size**, so the size boxes hide and the customer only types the weight ("The size comes from the packaging: just type the weight").
  - **Only the right services show:** USPS Flat Rate items by Priority Mail; USPS Express envelopes by Priority Mail Express; UPS Express items by UPS air services; FedEx items by FedEx Express services.
  - **The carrier is told the packaging**, when pricing and on the label (USPS rate indicator, UPS packaging code, FedEx packaging type).
  - **Tube or irregular** ticks "Irregular package" and opens Extra services so the customer sees it.
  - **Clear messages:** USPS packaging over 70 lb is refused; a combination nothing can carry (for example hazardous materials in a flat rate box, which must go by Ground Advantage) says so instead of showing an empty list.
  - Each carrier item says **"Ask for one at our counter"**, to bring people in for the free carrier packaging.
  - The **counter page** shows the packaging; **saved packages** remember it.
  - Sizes now accept decimals (12.5 in), for flat rate sizes and for customers' own boxes.
  - Demo rates gained UPS 2nd Day Air, FedEx 2Day and USPS Priority Mail Express, so carrier packaging can be tried before the carrier accounts are connected.
  - All new text in all 14 languages. Carrier product names stay in English, as printed on the packaging.
- **Pictures:** the general, USPS and UPS pictures are cropped from the Pirate Ship screenshots Peter supplied, **for now**: they belong to Pirate Ship or the carriers, so they should be replaced before the site goes live (D10 in [FOR-WILLIAM.md](FOR-WILLIAM.md)). The 7 FedEx pictures are drawn by the store in FedEx's colors, without FedEx's logo. All live in `site/public/packaging/` (308 KB), so swapping them is just replacing files.
- **Why:** Flat rate and carrier packaging can save customers a lot, there's nothing to measure, and the store avoids carrier adjustment charges when packaging is declared correctly.
- **Files:** [packaging catalog and rules (new)](../site/src/lib/packaging.ts), [tests (new)](../site/tests/packaging.test.ts), [pictures (new)](../site/public/packaging/), [ship page](../site/src/pages/ship/index.astro), [parcel checks](../site/src/lib/validate.ts), [rate engine](../site/src/shipping/engine.ts), [USPS](../site/src/shipping/providers/usps.ts), [UPS](../site/src/shipping/providers/ups.ts), [FedEx](../site/src/shipping/providers/fedex.ts), [demo rates](../site/src/lib/easyship.ts), [shipment types](../site/src/shipping/types.ts), [counter page](../site/src/pages/counter/[code].astro), [text, 14 languages](../site/src/i18n/strings.ts), [staff text](../site/src/i18n/staff3.ts), [styles](../site/src/styles/global.css)
- **How to check it:** `git pull`, open http://localhost:4321/ship. Under "What is it?", click **Change** next to Packaging and pick **USPS Priority Mail Medium Flat Rate Box**: the size boxes disappear. Fill in the rest and Get rates: only USPS Priority Mail. Try a UPS or FedEx item: only that carrier's express services.
- **Checks run:** 147 tests pass (11 new, including that every picture file exists), the type check is clean, the site builds. In a real browser: all 25 items listed with pictures, every carrier rule above, the 70 lb limit, the hazmat-plus-flat-rate message, and a flat rate order showing its packaging on the counter page.
- **Bug caught while testing:** the size boxes only accepted whole inches, so a flat rate box's 8.5 in size blocked Get rates silently. Fixed by allowing decimals.

## 2026-11-14 12:37 CST · Return labels on the Ship page

- **Asked for:** the Pirate Ship "Return Labels" tick box (screenshot), with its two choices: "Return Labels Only" and "Return Labels Included".
- **What changed** (in **Extra services**, under Signature confirmation):
  - A **Return label** checkbox. Ticking it opens two choices:
    - **Return label only** (picked by default): swaps the addresses, so the one label runs from the "Where is it going?" address back to the return address. The order is marked as a return.
    - **Return label included**: the outgoing label plus a return label. Each rate shows the return label's price under it ("+ $9.65 return label"), and the total includes it.
  - The return label uses **the same service back** when that carrier offers it, otherwise the same carrier's cheapest, otherwise the cheapest of all. It has no signature and no insurance.
  - Both labels are bought when the order is paid. The **done page** shows the return label line and a "Download return label" button; the **counter page** shows it with its tracking number and "Open return label to print". It's recorded as its own shipment (pickup code + "-R") for reports and tracking.
  - If the return label can't be bought after the outgoing one was, the outgoing label still stands, and the counter page shows a red note to buy the return label by hand.
  - A business account's discount applies to the return label too. On the card payment page it's its own line.
  - Saved packages remember the return label choice.
  - All new text in all 14 languages.
- **Why:** Sellers who expect returns can send a return label with every package, and anyone can buy just a return label.
- **How it's charged, for now:** the return label is **charged now, at the price shown** (the page says so). Pirate Ship's "charges postage only if used" needs the postal service's pay-on-use returns on the store's own account, plus a way to bill the customer later. That's a decision for the prices meeting (D9 in [FOR-WILLIAM.md](FOR-WILLIAM.md)).
- **Files:** [ship page](../site/src/pages/ship/index.astro), [return label rules](../site/src/lib/options.ts), [tests](../site/tests/options.test.ts), [rates](../site/src/pages/api/rates.ts), [orders](../site/src/pages/api/orders.ts), [order record](../site/src/lib/orders.ts), [card payment](../site/src/lib/stripe.ts), [label step](../site/src/lib/fulfil.ts), [done page](../site/src/pages/ship/done.astro), [counter page](../site/src/pages/counter/[code].astro), [text, 14 languages](../site/src/i18n/strings.ts), [staff text](../site/src/i18n/staff3.ts), [styles](../site/src/styles/global.css)
- **How to check it:** `git pull`, open http://localhost:4321/ship, fill in the form, open **Extra services**, tick **Return label**.
  - Leave **Return label only**, Get rates, pay: the done page says the label goes *to* your return address.
  - Pick **Return label included**, Get rates: each rate shows "+ $X return label"; pick one and the total includes it. Pay: the done page has both download buttons.
- **Checks run:** 136 tests pass (4 new), the type check is clean, the site builds. Both choices bought in a real browser: "only" sent the label to the sender's address; "included" charged $19.98 on the page and the order alike, and both labels showed on the done and counter pages.

## 2026-11-14 12:25 CST · Meeting notes for Peter and William

- **Asked for:** "Let's make sure we are documenting all these hiccups so when me and William meet again we can pick up what we are talking about."
- **What changed:**
  - New file [FOR-WILLIAM.md](FOR-WILLIAM.md), in five sections:
    1. **Problems found** (H1 to H5): the two missing README setup steps, the insurance that was charged but never bought, the signature total bug, and the address dropdown that looked broken.
    2. **Changes to William's code**, and why each is worth his review.
    3. **Things to check once carrier accounts are connected.**
    4. **Decisions waiting** (D1 to D8), with who decides.
    5. **Things left alone on purpose.**
  - A new rule in Peter's Claude instructions: every future hiccup, open decision or change to William's code goes into this file in the same commit, so it stays current without being asked.
- **Why:** So the next meeting with William starts from one page instead of memory.
- **Files:** [FOR-WILLIAM.md (new)](FOR-WILLIAM.md), [CLAUDE.md](CLAUDE.md) (rule 6), [README.md](README.md) (lists the new file)
- **How to check it:** On GitHub, open the `peter` folder on the `peter` branch and click FOR-WILLIAM.md.

## 2026-11-14 12:23 CST · Insurance is now bought from the carrier with the label

- **Asked for:** "Yes, let's make that fix." (Insurance should be added with each carrier when we buy the label.)
- **The problem found:** the website charged customers the insurance fee, but when it bought the label it never told USPS, UPS or FedEx about the declared value. The label only had the carrier's free built-in cover (usually $100). A lost $450 package would have left the store owing the difference. Nothing went wrong in practice: the site isn't live yet.
- **What changed:** when an insured order's label is bought, the carrier's own insurance is added to that label for the amount the customer insured:
  - **USPS:** USPS insurance (up to $500, or over $500) for the insured amount.
  - **UPS:** declared value for the insured amount.
  - **FedEx:** declared value for the insured amount.
  - **Easyship** (the stand-in until the carrier accounts are connected): its insurance option.
  - Orders without insurance send nothing extra, even if a value was typed.
  - This covers every way a label is bought: the website, the counter queue and business accounts all go through the same step.
- **Why:** So insurance the customer pays for is real, and a claim goes through the carrier on an insured label, the same way it works at the counter.
- **To check when carriers are connected:** the field names follow each carrier's published format, but the site still runs on demo rates. On the first real insured label from each carrier, check the carrier's receipt shows the insurance.
- **For Rin:** the carrier charges the store its own fee for this insurance. The store charges customers $1.25 per $100 above $100 ($2.75 minimum). Confirm that covers the carrier's cost; change it at /counter/rules.
- **Files:** [carrier label extras (new)](../site/src/lib/labelExtras.ts), [label step](../site/src/lib/fulfil.ts), [USPS](../site/src/shipping/providers/usps.ts), [UPS](../site/src/shipping/providers/ups.ts), [FedEx](../site/src/shipping/providers/fedex.ts), [Easyship](../site/src/lib/easyship.ts), [shipment types](../site/src/shipping/types.ts), [tests (new)](../site/tests/label-extras.test.ts), [tests (new)](../site/tests/fulfil-insurance.test.ts)
- **Checks run:** 132 automated tests pass (8 new: each carrier's insurance fields, insurance plus signature together, and the label step passing the amount only when insurance was bought), the type check is clean, the site builds.

## 2026-11-14 12:13 CST · Insurance offer moved above Extra services

- **Asked for:** "Let's add an insurance tick box above extra services because I want to try to sell them the service."
- **What changed:**
  - The **Insure it for the full value** checkbox moved from the payment section (after rates) up into "What is it?", **right above Extra services**, in a box with a dark border so it stands out.
  - Ticking it still opens **Value in USD** below it, and the fee now shows **as soon as the value is typed**, before Get rates ("+ $5.00 to cover $450"). At $100 or less it says the carrier covers it for free.
  - If insurance is ticked but no value is typed, Get rates asks for the value first.
  - The insurance fee is still added to the total after a rate is picked, and the order is charged the same amount. It no longer appears a second time in the payment section.
- **Why:** Every customer sees the insurance offer early, before they've picked a rate, which should sell more of it.
- **Files:** [ship page](../site/src/pages/ship/index.astro), [styles](../site/src/styles/global.css)
- **How to check it:** `git pull`, open http://localhost:4321/ship. The insurance box sits above "Extra services". Tick it, type 450: the fee shows at once. Get rates and pick one: the total includes the $5.00.
- **Checks run:** 124 tests pass, the site builds. In a real browser: the box is above Extra services, Get rates is blocked until a value is typed, the fee shows before rates, the total includes it, and the order was sent with the $450 value.

## 2026-11-14 11:35 CST · Extra services checkboxes on the Ship page, with a hazardous materials guide

- **Asked for:** "I want tickbox features to populate whatever the customer may want" (from the Pirate Ship screenshot), "let's disregard the international/customs box for now", and a pop-up guide like Pirate Ship's "Learn how to ship Hazardous Materials" link.
- **What changed** (all in the "What is it?" section, before Get rates, because they change which rates show):
  - **Extra services** (a fold-out section):
    - **Signature confirmation (+$3.50):** adds the store's signature add-on to the order and tells USPS, UPS or FedEx to require a signature on the label. The price comes from the add-on list at /counter/rules.
    - **Qualifies for Media Mail:** adds the cheap, slow USPS Media Mail rate to the list. Media Mail never shows unless this is ticked.
    - **Irregular package:** tells USPS it's not a standard box, so it's priced right.
  - **Hazardous materials:** only USPS Ground Advantage is offered, the label tells USPS it contains hazardous materials, and a reminder about the Limited Quantity mark shows. Online it is allowed only within the lower 48 states and DC; Alaska, Hawaii, territories and military addresses get a message to come to the counter.
  - **"Learn how to ship hazardous materials":** opens a guide window over the page (common items, packing, service and label, electronics, where it can go, a link to USPS Publication 52). "Got it, back to my shipment", Escape, or a click outside closes it. Written for the store in its own words from the USPS rules, not copied from Pirate Ship.
  - **Save this package for next time:** keeps the size, weight, contents and ticked boxes on that computer or phone (up to 5). Next visit, a "Saved packages" list fills them in with one pick; "Forget saved packages" clears it.
  - The **done page** repeats the Limited Quantity reminder, and the **staff counter page** shows a red warning to check the mark before accepting a hazardous package.
  - All new text is in all 14 of the site's languages.
- **Why:** Match what customers see on Pirate Ship, and keep hazardous packages legal: USPS fines the sender when hazardous items aren't declared on the label.
- **Bug caught while testing:** the page total first left out the $3.50 signature fee while the order still charged it. Fixed: the page now shows exactly what is charged.
- **Limits to know:**
  - The carrier-side settings (signature, hazmat, irregular, Media Mail) are written to each carrier's published format but can only be fully proven once the real carrier accounts are connected; today the site runs on demo rates.
  - While labels go through Easyship (the stand-in until the direct carrier accounts are live), signature and hazmat are not passed to Easyship yet.
  - Irregular package changes USPS pricing only.
  - Customs (international) is left out on purpose. Return labels are next, as P2 on the to-do list.
- **Files:** [ship page](../site/src/pages/ship/index.astro), [extra services rules (new)](../site/src/lib/options.ts), [tests (new)](../site/tests/options.test.ts), [rate engine](../site/src/shipping/engine.ts), [USPS](../site/src/shipping/providers/usps.ts), [UPS](../site/src/shipping/providers/ups.ts), [FedEx](../site/src/shipping/providers/fedex.ts), [orders](../site/src/pages/api/orders.ts), [done page](../site/src/pages/ship/done.astro), [counter page](../site/src/pages/counter/[code].astro), [parcel checks](../site/src/lib/validate.ts), [demo rates](../site/src/lib/easyship.ts), [shipment types](../site/src/shipping/types.ts), [text, 14 languages](../site/src/i18n/strings.ts), [staff text](../site/src/i18n/staff3.ts), [styles](../site/src/styles/global.css)
- **How to check it:** `git pull`, open http://localhost:4321/ship, fill in the form. Open **Extra services** and tick **Media Mail**, press Get rates: "USPS Media Mail" appears. Untick it, tick **Hazardous materials**, Get rates: only USPS Ground Advantage. Click **Learn how to ship hazardous materials** to see the guide. Tick **Signature confirmation**, pick a rate: the total goes up by $3.50 plus the online fee. Tick **Save this package**, get rates, then reload the page: "Saved packages" appears at the top of "What is it?".
- **Checks run:** 124 automated tests pass (6 new), the type check is clean, the site builds. Every checkbox was tried in a real browser, including buying an order with signature and hazmat and opening it on the counter page.

## 2026-11-14 11:03 CST · To-do list started, with international shipping as the first item

- **Asked for:** "Let's do that" (put international shipping on the to-do list instead of building it now).
- **What changed:** Added Peter's own to-do list. Its first item, P1, is international shipping online: how Pirate Ship does it, where the store's risk is higher, the business steps, the build steps, and questions for William and Rin.
- **Why:** The US-only site isn't live yet, the paperwork has to come before the code, and William removed international on November 7, so it's a decision for all three.
- **Files:** [TODO.md (new)](TODO.md), [README.md](README.md) (lists the new file)
- **How to check it:** On GitHub, open the `peter` folder on the `peter` branch and click TODO.md.

## 2026-11-14 10:58 CST · Item value only asked when insurance is ticked

- **Asked for:** "I don't like it has an item value. I don't see the point of having it unless the customer is adding insurance. So let's make it like Pirate Ship where if they click insurance it will pop up a fill in the blank for declared value in dollars."
- **What changed:**
  - The **Value in USD** box is gone from the "What is it?" section of the Ship page.
  - The **Insure it for the full value** checkbox now always shows under the rates. When the customer ticks it, a **Value in USD** box opens right below it.
  - As they type the value, the insurance fee and the total update on the spot: "+ $5.00 to cover $450". At $100 or less it says the carrier covers it at no charge.
  - Without insurance, no value is sent with the order at all.
- **Why:** Fewer boxes for customers who don't want insurance, and the value is asked at the moment it matters, the way Pirate Ship does it.
- **Behind the scenes:** The fee formula moved to its own small file, so the page and the server use the exact same math and the price shown is the price charged. The fee terms themselves (first $100 free, $1.25 per $100 after, $2.75 minimum, $5,000 maximum) are unchanged and still edited at /counter/rules.
- **Files:** [ship page](../site/src/pages/ship/index.astro), [insurance math (new)](../site/src/lib/insurance.ts), [add-ons](../site/src/lib/addons.ts)
- **How to check it:** `git pull`, open http://localhost:4321/ship, fill in the form and press Get rates. Pick a rate, tick **Insure it for the full value**, type 450: the fee shows $5.00 and the total goes up. Type 80: it says the carrier covers it. Untick it and the box goes away.
- **Checks run:** all 118 tests pass, the type check is clean, the site builds. Tried in a real browser: insured order sent with value $450 and the done page shows the insurance; uninsured order sent with no value.
- **Not changed:** the staff counter's own quote screen still has its value box.

## 2026-11-14 10:51 CST · Address dropdown on both street boxes of the Ship page

- **Asked for:** "In the fill in the blanks for customer information I want to start to have a dropdown menu ... once I type in an address I want the system to give them possible addresses ... so it can populate the rest of the blanks like city, state, zip code."
- **What changed:**
  - The **Return address** (sender) street box now shows a dropdown of matching addresses as you type, the same as the recipient box already did. Picking one fills in the street, city, state and ZIP.
  - Both boxes now give suggestions from **just the street** (for example "1800 Forsythe Ave"). Before, the free address lookup only answered once a city was typed too ("1800 Forsythe Ave, Monroe"). Now, when no city or ZIP is typed, it also looks in the store's own city (Monroe, LA).
  - Typing a city after a comma ("..., Dallas") or a ZIP still searches anywhere in the US.
- **Why:** Faster checkout and fewer typos in addresses, which means fewer returned or misdelivered packages.
- **Limits to know:** The free lookup (US Census Bureau) needs the full street name, so "1800 Forsy" shows nothing until "Forsythe Ave" is finished. True letter-by-letter suggestions, like Google Maps, need a Google Places key, which costs money past a free monthly allowance (already listed as issue 18 in William's repo). That is a decision for Peter and Rin.
- **Files:** [ship page](../site/src/pages/ship/index.astro), [address lookup](../site/src/pages/api/address-suggest.ts), [address helpers](../site/src/lib/address.ts), [new test](../site/tests/address-typeahead.test.ts)
- **How to check it:** `git pull`, then open http://localhost:4321/ship. In the Return address section, type a full street with no city, like your home street, and wait a second. A list appears; click one and the city, state and ZIP fill in. Try the same in "Where is it going?"
- **Checks run:** all 118 automated tests pass, the type check is clean, and the site builds. Both dropdowns were tried in a real browser.

## 2026-11-14 10:37 CST · Set up Peter's section

- **Asked for:** "a tabbed section for Pete's edits ... so our work wouldn't affect each other. I'd have my own section and my own readme section ... a date and time stamp per edit."
- **What changed:** Made Peter's own branch (`peter`) and folder (`peter/`), with a README explaining how it stays separate from William's work, this edit log, and a set of instructions so Claude logs every future edit here with the date and time.
- **Why:** So Peter can make and document his own changes, and William can review them, without either person's work changing the other's until both agree.
- **Files:** [README.md](README.md), [EDIT-LOG.md](EDIT-LOG.md), [CLAUDE.md](CLAUDE.md)
- **How to check it:** On GitHub, switch the branch picker to `peter` and open the `peter` folder.
- **Note for William:** While setting up the site on Peter's Windows PC, two steps were missing from the root README's "Run the website" guide. First, `npm run db:local` must be run once, or Get rates fails with `D1_ERROR: no such table: retail_rules`. Second, on Windows, `npm` is blocked until `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` is run once. Worth adding both to the README.
