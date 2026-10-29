#!/usr/bin/env python3
"""Stand up PeterShip for another store.

One deployment per store, same code, its own facts, database, orders and secrets. This script does
the part that is files and prints the part that is commands, so an owner can follow it line by line.

    python scripts/new-store.py west-carroll --name "Goin' Postal Oak Grove" --address "123 Main St, Oak Grove, LA 71263" --phone "(318) 555-0100" --email owner@example.com --site https://oakgrove.goinpostal.site

It writes site/stores/<slug>.json (the facts, editable afterwards) and prints:
  1. the Cloudflare project to create (Workers, root directory site, build command npm run build),
  2. the KV namespace and D1 database to create and paste into a wrangler.jsonc environment,
  3. the secrets to set, STORE_JSON among them, with the exact commands.
Nothing is created in Cloudflare by this script; it only prepares and explains.
"""
import argparse, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
STORES = ROOT / 'site' / 'stores'


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('slug', help='short name, letters and dashes: west-carroll')
    ap.add_argument('--name', required=True, help="store name as customers see it: Goin' Postal Oak Grove")
    ap.add_argument('--address', required=True, help='street, city, state ZIP, one line')
    ap.add_argument('--phone', required=True, help='(318) 555-0100')
    ap.add_argument('--email', required=True)
    ap.add_argument('--site', required=True, help='the store website address, https://...')
    ap.add_argument('--line1', help='ship-from street line, defaults to the first part of --address')
    ap.add_argument('--city'); ap.add_argument('--state'); ap.add_argument('--zip')
    a = ap.parse_args()

    if not re.fullmatch(r'[a-z][a-z0-9-]{1,30}', a.slug):
        print('slug must be lowercase letters, digits and dashes, like west-carroll', file=sys.stderr); return 2
    parts = [p.strip() for p in a.address.split(',')]
    line1 = a.line1 or parts[0]
    city = a.city or (parts[1] if len(parts) > 1 else '')
    m = re.search(r'([A-Z]{2})\s+(\d{5})', a.address)
    state = a.state or (m.group(1) if m else '')
    zip_ = a.zip or (m.group(2) if m else '')
    digits = re.sub(r'\D', '', a.phone)
    e164 = '+1' + digits[-10:] if len(digits) >= 10 else ''

    facts = {
        'id': a.slug, 'name': a.name, 'address': a.address, 'phone': a.phone, 'email': a.email,
        'origin': { 'contact_name': a.name, 'company_name': a.name, 'contact_phone': e164, 'contact_email': a.email, 'line_1': line1, 'city': city, 'state': state, 'postal_code': zip_, 'country_alpha2': 'US' },
        'formEndpoint': 'https://formspree.io/f/REPLACE_ME',
        # The switcher on the counter pages (T23): this store sees Forsythe; add this store to Forsythe's STORE_JSON siblings too.
        'siblings': [{ 'id': 'forsythe', 'name': "Goin' Postal Forsythe", 'url': 'https://goinpostalforsythe.com' }],
    }
    STORES.mkdir(exist_ok=True)
    out = STORES / f'{a.slug}.json'
    out.write_text(json.dumps(facts, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {out.relative_to(ROOT)}. Edit hours and services there if they differ from Forsythe; what is left out keeps the Forsythe default.\n')

    print('Next, in order. Each command is typed in a terminal inside the site/ folder after `npx wrangler login`.\n')
    print(f'1. Cloudflare dashboard: Workers & Pages, Create, connect this GitHub repo, name "{a.slug}", root directory `site`,')
    print(f'   build command `npm run build`, and under Settings, Variables add STORE_ID = {a.slug} and SITE_URL = {a.site}.\n')
    print('2. Storage for this store only:')
    print(f'   npx wrangler kv namespace create ORDERS --env {a.slug}')
    print(f'   npx wrangler d1 create goin-postal-{a.slug}')
    print(f'   Paste both ids into the "{a.slug}" block under "env" in site/wrangler.jsonc (there is a commented example), then')
    print(f'   npx wrangler d1 execute goin-postal-{a.slug} --remote --file db/schema.sql\n')
    print('3. Secrets, each with `npx wrangler secret put NAME --env ' + a.slug + '` and the value pasted when asked:')
    print(f'   STORE_JSON      the contents of stores/{a.slug}.json (one line is fine: python -c "import json;print(json.dumps(json.load(open(\'stores/{a.slug}.json\'))))")')
    print('   COUNTER_PIN     a starting PIN; then add real people at /counter/staff and retire it')
    print('   PRINTER_KEY     any long random string, the same one in that store\'s printer-agent.json')
    print('   EASYSHIP_TOKEN, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, MAIL_FROM, TWILIO_* as that store signs up for each\n')
    print('4. Deploy by pushing to main (the Cloudflare project builds it), open the site, type the PIN on /counter/queue.')
    print('   Prices, add-ons, staff and accounts are set on the counter pages; they live in this store\'s own database.\n')
    print(f'Locally: put STORE_JSON=<the json on one line> in site/.dev.vars to run `npm run dev` as {a.name}.')
    print(f'\nSwitcher: stores/{a.slug}.json lists Forsythe under "siblings". Add {{"id": "{a.slug}", "name": "{a.name}", "url": "{a.site}"}} to Forsythe\'s siblings (its STORE_JSON secret, or src/data/store.ts) so both counters show the other.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
