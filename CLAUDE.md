# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A public repo for Goin' Postal Forsythe, a shipping store in Monroe, Louisiana. Two kinds of content:

- `site/`: the store website (Astro 7 on Cloudflare) and **PeterShip**, the store's own shipping client (`site/src/shipping/`, the `/counter/*` staff pages, the `/api/*` routes). This is where nearly all code work happens. No PHP anywhere, deliberately.
- Everything else is plans and marketing: `AGENDA.md` (the numbered agenda items and the T-numbered PeterShip to-do list, plus a dated log), `research/` (next-store site research), `monetization/`, `shipping-client/` (connectors, printer agent, LLC drafts, rate plans), `designs/`, and the root `README.md`.

Owners are Peter (owner and manager, main decision maker) and Rin (investor). Address decision questions in plans to "Peter and Rin". Python scripts import `scripts/owner_guard.py` and stop unless `GOIN_POSTAL_OWNER` is set or `.owner-key` exists at the repo root.

## Commands (run in `site/`)

```
npm install
npm run dev                 # http://localhost:4321, bindings via the Cloudflare adapter's proxy
npm test                    # astro check && vitest run && astro build  (what CI runs)
npm run check               # astro check only (type-checks pages, APIs, libs)
npm run test:unit           # vitest run
npx vitest run tests/pickups.test.ts        # one test file
npx vitest run -t "low stock"               # tests matching a name
npm run db:local            # re-apply db/schema.sql to the local D1 (run after any schema change)
```

Local secrets go in `site/.dev.vars` (copy `.dev.vars.example`; `COUNTER_PIN=1234` is the staff PIN for local testing). Blank values mean mock mode: emails and texts are logged to the terminal as `[mock email] ...`, and labels are demo labels. Without a D1 binding the store falls back to memory.

Root-level CI also runs `node --check` on every `shipping-client/**/*.mjs` connector, `python -m py_compile scripts/*.py`, re-runs `site/db/schema.sql` twice in sqlite (it must be re-runnable), `scripts/check_designs.py`, and renders every Mermaid chart in the READMEs with `@mermaid-js/mermaid-cli@11`. New connectors need adding to the `node --check` line in `.github/workflows/ci.yml`.

## Architecture

**Rates and payments never talk to each other.** `src/shipping/engine.ts` asks every configured carrier provider (`providers/{usps,ups,fedex,dhl}.ts`, each switched on only when its env keys exist) in parallel, with `providers/easyship.ts` filling in whatever has no direct adapter, then applies the store's retail rules from `lib/pricing.ts` and caches for five minutes. Stripe (`lib/stripe.ts`, `api/stripe-webhook.ts`) handles online cards; in-store payment is the POS and a button on the counter page.

**Two stores of record.** Orders (quote, paid, labeled, printed, voided) live in Cloudflare KV (`lib/orders.ts`, binding `ORDERS`). Everything else PeterShip keeps is in D1 (`src/shipping/store.ts`, binding `DB`, schema in `db/schema.sql`). `store.ts` is the one place with SQL. Every table has three parts that must stay in step: a `CREATE TABLE IF NOT EXISTS` in `schema.sql`, store functions with a D1 branch and a memory branch (the `mem` object and the `memTable` switch), and an entry in `EXPORT_TABLES` (which drives `/counter/export`). Tests run against the memory branch: `vitest.config.ts` aliases `cloudflare:workers` to `tests/stubs/cloudflare-workers.ts`, so nothing has bindings.

**Env and store facts.** `lib/env.ts` re-exports `cloudflare:workers` env typed as `Env`. `src/data/store.ts` holds the Forsythe facts; a second store is the same code with `STORE_JSON` set from `site/stores/<slug>.json` and its own block in `wrangler.jsonc` (`scripts/new-store.py`).

**Staff APIs** (`src/pages/api/*.ts`) take a JSON body with `action` and `pin`; call `authenticate(env, pin)` from `lib/auth.ts` (personal hashed PINs in the `staff` table, roles counter/manager/owner, shared `COUNTER_PIN`/`OWNER_PIN` as fallbacks) and write `logAudit(env, user, 'thing.verb', id, detail)` for anything that changes state. `api/account.ts` is the customer-side counterpart, authenticated by the session cookie from `lib/session.ts` (magic-link login). The public API for business accounts is `api/v1/[...path].ts` with Bearer `psk_` keys (`lib/apikeys.ts`); `public/openapi.json` documents it and `tests/openapi.test.ts` fails if the spec and the route's `path === '...'` branches disagree.

**Counter pages** (`src/pages/counter/*.astro`) share a staff nav that is a literal line in every page, so adding a page means patching the nav in all of them. Page scripts fetch the staff APIs with the PIN stored in the browser.

**i18n.** Every customer-facing string is a key in `src/i18n/strings.ts` (14 languages, English first), staff strings in `staff.ts`/`staff2.ts`/`staff3.ts`. Markup uses `data-i18n="key"`; scripts use `t('key')`/`tf()`. Keys must be unique across all four files. New strings need all 14 languages.

**Pure helpers in `src/lib/`** (`batch.ts`, `fulfillment.ts`, `mailboxes.ts`, `pricing.ts`, `packing.ts`, ...) are tested directly in `tests/`; fee tables and thresholds live in `src/data/*.json` for the owners to edit.

**Connectors** in `shipping-client/*-connector/connector.mjs` are standalone Node 24 scripts with no packages: they poll a marketplace, buy labels through the public `/api/v1`, and mark the order shipped. Same shape each time; copy the latest one.

## Releases and docs

Every finished piece of work gets a tag and a GitHub release with full detail, and the docs are updated in the same commit: the `AGENDA.md` to-do row and dated log line, `site/README.md` feature list, the relevant `shipping-client/*/README.md`, and Mermaid charts where the flow changed (validate with `npx -y @mermaid-js/mermaid-cli@11`). Release flow:

```
git tag vX.Y.Z && git push origin main vX.Y.Z
python scripts/release_notes.py vX.Y.Z --body narrative.md > full.md   # narrative + linked changelog of every file changed
gh release create vX.Y.Z --title "vX.Y.Z: ..." --notes-file full.md
python scripts/changelog.py && git commit -am "CHANGELOG.md: vX.Y.Z"   # rebuilds CHANGELOG.md from the releases; wait a few seconds after the release first
```

Owner-facing follow-ups (keys to obtain, prices to confirm, schema re-runs) go in GitHub issues, not in code comments alone.
