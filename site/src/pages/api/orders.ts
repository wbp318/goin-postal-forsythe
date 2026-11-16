export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { quote } from '../../lib/quote';
import { newOrderId, saveOrder, type Order } from '../../lib/orders';
import { createCheckout } from '../../lib/stripe';
import { readSession } from '../../lib/session';
import { saveCustomerAddress, listCustomerAddresses } from '../../shipping/store';
import { parseAddress, parseParcel, json } from '../../lib/validate';
import { store } from '../../data/store';
import { effectiveAddons, priceExtras, onlineFee, salesTax, taxableExtras, shipPagePicks } from '../../lib/addons';
import { accountForContact } from '../../shipping/store';
import { checkAddress } from '../../lib/address';
import { getCustomer, setCustomerName, normalizePhone, recordConsent, phoneHolder } from '../../shipping/store';
import { loggedWording } from '../../lib/consent';
import { directed, pickReturnRate, returnParcel } from '../../lib/options';
import { onlineLabelsOn } from '../../lib/siteSettings';

// Customer picked a rate: start Stripe Checkout. Domestic only since Nov 7, 2026 (parseAddress refuses the rest).
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    // The owners' switch (/counter/settings, Peter Nov 14 2026): Off means no shipping online at all.
    if (!(await onlineLabelsOn(env))) return json({ error: 'Shipping is in the store for now. Bring your package to the counter.', offline: true }, 403);
    // Buying a label online needs a free account (Peter, Nov 14 2026). Quotes stay open to everyone.
    const meId = await readSession(env, request.headers.get('cookie'));
    const me = meId ? await getCustomer(env, meId) : null;
    if (!me || !me.email) return json({ error: 'Sign in to buy your label.', signin: true }, 401);
    const parcel = parseParcel(b.parcel, { options: true });
    // "Return label only" swaps the addresses (the label runs from the receiver back to the sender) and makes it a return.
    // `to` is the "Where is it going?" address as typed, before any swap: the one the address book keeps.
    const to = parseAddress(b.destination);
    const { origin, destination, kind } = directed(b.origin ? parseAddress(b.origin) : store.origin, to, parcel.options);
    const check = checkAddress(destination);
    if (check.errors.length) throw new Error(check.errors[0]);
    const email = me.email;
    // First purchase: the account gets a mobile number (for problems with a shipment) and a real name.
    const acctPhone = normalizePhone(String(b.acct_phone ?? ''));
    if (!me.phone && !acctPhone) throw new Error('Enter your mobile number');
    const name = me.name && me.name !== 'Customer' ? me.name : (String(b.origin?.contact_name ?? '').trim().slice(0, 60) || me.name);
    // The number is kept on the account only when it isn't already another customer's.
    const keepPhone = acctPhone && !(await phoneHolder(env, acctPhone, me.id)) ? acctPhone : null;
    if (!me.phone || name !== me.name) await setCustomerName(env, me.id, name, me.phone ? null : keepPhone);
    const sms = b.sms === true || b.sms === 'on';
    const phone = String(b.phone ?? '').replace(/[^\d+]/g, '').slice(0, 16) || (me.phone ?? acctPhone ?? '');
    if (sms && phone.replace(/\D/g, '').length < 10) throw new Error('Enter a phone number for text updates, or untick the box');

    // Re-quote server side so the price cannot be edited in the browser.
    const { rates } = await quote(env, origin, destination, parcel);
    const found = rates.find((r) => r.id === b.rate_id);
    if (!found) throw new Error('That rate is no longer available. Please quote again.');
    // A business account gets its discount online too when its holder is signed in (the email is proven by the
    // sign-in link); the card is still charged now.
    const account = me?.email ? await accountForContact(env, me.email, null) : null;
    const rate = account && account.discount_percent ? { ...found, total_charge: Math.round(found.total_charge * (1 - account.discount_percent / 100) * 100) / 100 } : found;

    const cfg = await effectiveAddons(env);
    // Text updates and signature confirmation are priced add-ons decided here from the customer's choices (the text
    // box, parcel.options.signature), one line each; signature is refused while its add-on is off (lib/addons.ts).
    const picks = shipPagePicks(cfg, b.addons, { signature: !!parcel.options?.signature, sms });
    // The insurance fee depends on the service: Media Mail includes no cover (lib/insurance.ts).
    const extras = priceExtras(cfg, picks, parcel.value_usd, b.insure === true || b.insure === 'on', rate.service);
    // "Return label included": re-quote the way back on the server and charge the return label now, at the price shown.
    let return_rate: Order['return_rate'];
    if (parcel.options?.return_label === 'included') {
      const back = await quote(env, destination, origin, returnParcel(parcel));
      const r = pickReturnRate(found, back.rates);
      if (!r) throw new Error('No return label is available for this address. Untick Return label or quote again.');
      return_rate = account && account.discount_percent ? { ...r, total_charge: Math.round(r.total_charge * (1 - account.discount_percent / 100) * 100) / 100 } : r;
    }
    const subtotal = Math.round((rate.total_charge + extras.extras_total + (return_rate?.total_charge ?? 0)) * 100) / 100;
    const tax = salesTax(cfg, taxableExtras(extras));
    const fee = onlineFee(cfg, subtotal);
    const order: Order = {
      id: newOrderId(),
      status: 'awaiting_payment',
      created_at: new Date().toISOString(),
      email, phone: sms ? phone : undefined, sms, origin, destination, parcel, rate, international: false, kind, return_rate,
      name, // the customer's own name: without it the saved quote fell back to the recipient's name and renamed the customer (H9)
      addons: extras.addons.length ? extras.addons : undefined, insurance: extras.insurance, tax, fee, total: Math.round((subtotal + (tax?.amount ?? 0) + (fee?.amount ?? 0)) * 100) / 100,
      account_name: account?.business_name, discount_percent: account?.discount_percent || undefined,
    };
    await saveOrder(env, order);
    // Marketing: only a box the customer ticked is a yes, logged with the exact wording as proof. Unticked changes nothing.
    if (b.mkt_email === true) await recordConsent(env, { customer_id: me.id, channel: 'email', granted: true, contact: email, wording: loggedWording('email', b.lang), source: 'ship_page' });
    const mktPhone = me.phone ?? acctPhone;
    if (b.mkt_sms === true && mktPhone) await recordConsent(env, { customer_id: me.id, channel: 'sms', granted: true, contact: mktPhone, wording: loggedWording('sms', b.lang), source: 'ship_page' });
    // A signed-in customer (T20) can keep the address for next time; duplicates are skipped. It is the recipient as
    // typed (`to`), also with "Return label only", where the label's destination is the customer's own return address.
    if (b.save_address === true) {
      const cid = await readSession(env, request.headers.get('cookie'));
      if (cid) {
        const key = (d: any) => `${d.contact_name}|${d.line_1}|${d.line_2 ?? ''}|${d.postal_code}`.toLowerCase().replace(/\s+/g, ' ');
        const have = (await listCustomerAddresses(env, cid)).some((a) => key(JSON.parse(a.address_json)) === key(to));
        if (!have) await saveCustomerAddress(env, { customer_id: cid, label: to.contact_name, address_json: JSON.stringify(to) });
      }
    }

    const url = await createCheckout(env, order);
    return json({ order_id: order.id, next: url });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
