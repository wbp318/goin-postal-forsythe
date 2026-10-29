export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json, parseAddress } from '../../lib/validate';
import { checkAddress } from '../../lib/address';
import { quote } from '../../lib/quote';
import { choose, discounted } from '../../lib/batch';
import { newOrderId, saveOrder, type Order } from '../../lib/orders';
import { fulfil } from '../../lib/fulfil';
import { getReturnLink, getAccount, billShipmentToAccount, logAudit, saveContacts } from '../../shipping/store';
import { sendEmail } from '../../shipping/notify';
import { store } from '../../data/store';

// Merchant returns portal (to-do T22). A business account's own customer opens /return/<token>,
// types their address and what they are sending back, and gets a prepaid label by email. The label
// is a return (origin: the customer, destination: the merchant's return-to address), bought at the
// account's rates and billed to the account's next statement. No payment is taken from the customer.
const SIZES: Record<string, { weight_lb: number; length_in: number; width_in: number; height_in: number }> = {
  small: { weight_lb: 1, length_in: 10, width_in: 7, height_in: 4 },
  medium: { weight_lb: 3, length_in: 14, width_in: 10, height_in: 6 },
  large: { weight_lb: 8, length_in: 18, width_in: 14, height_in: 10 },
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json().catch(() => ({}));
    const link = await getReturnLink(env, String(b.token ?? ''));
    if (!link || !link.active) return json({ error: 'This return link is not active. Contact the seller.' }, 404);
    const account = await getAccount(env, link.account_id);
    if (!account || !account.active) return json({ error: 'This return link is not active. Contact the seller.' }, 404);
    const name = String(b.name ?? '').trim().slice(0, 60);
    const email = String(b.email ?? '').trim().toLowerCase();
    if (!name) throw new Error('Your name is needed');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A valid email is needed: the label is sent there');
    const origin = parseAddress({ ...b.address, contact_name: name, contact_email: email, contact_phone: String(b.phone ?? '').trim().slice(0, 20), country_alpha2: 'US' });
    const check = checkAddress(origin);
    if (check.errors.length) throw new Error(check.errors[0]);
    const size = SIZES[String(b.size)] ?? SIZES.medium;
    const parcel = { ...size, weight_lb: Math.min(link.max_weight_lb, size.weight_lb), description: String(b.item ?? 'Return').trim().slice(0, 80) || 'Return', value_usd: 1 };
    const destination = JSON.parse(link.return_to_json);
    const { rates } = await quote(env, origin, destination, parcel);
    const offered = rates.map((r) => discounted(r, account.discount_percent || 0));
    const rate = choose(offered, link.service ? { service: link.service } : 'cheapest') ?? choose(offered, 'cheapest');
    if (!rate) throw new Error('No carrier can take this return right now. Contact the seller.');
    const reference = String(b.reference ?? '').trim().slice(0, 40);
    const order: Order = {
      id: newOrderId(), status: 'reserved', created_at: new Date().toISOString(), email, name, source: 'counter', staff: `returns:${account.business_name}`.slice(0, 20),
      origin, destination, parcel, rate, international: false, kind: 'return', total: rate.total_charge,
      account_id: account.id, account_name: account.business_name, discount_percent: account.discount_percent || undefined,
      reference: reference || undefined, batch: `RL-${link.id}`,
    };
    await saveOrder(env, order);
    const done = await fulfil(env, { ...order, paid_at: new Date().toISOString() }, 'account');
    await billShipmentToAccount(env, done.id, account.id);
    await saveContacts(env, done.id, { email, phone: origin.contact_phone ?? null, sms_opt_in: false });
    await logAudit(env, { id: null, name: `Returns portal (${account.business_name})` }, 'label.buy', done.id, `return from ${name}, ${rate.carrier} ${rate.service} $${(done.total ?? rate.total_charge).toFixed(2)}${reference ? `, ref ${reference}` : ''}, billed to ${account.business_name}`);
    const l = done.label!;
    const abs = (u: string | null | undefined) => (u ? (u.startsWith('/') ? `${env.SITE_URL}${u}` : u) : null);
    const text = [
      `Here is your prepaid return label for ${account.business_name}.`, '',
      `${rate.service.toLowerCase().startsWith(rate.carrier.toLowerCase()) ? rate.service : `${rate.carrier} ${rate.service}`}${l.tracking_number ? `, tracking number ${l.tracking_number}` : ''}.`,
      abs(l.label_url) ? `Label (print on plain paper and tape it flat to the box): ${abs(l.label_url)}` : null,
      abs(l.qr_url) ? `No printer? Show this code at any ${rate.carrier} location and they print it: ${abs(l.qr_url)}` : null, '',
      `Pack the item, attach the label and hand the box to ${rate.carrier}, or bring it to ${store.name}, ${store.address}, and we will send it for you.`,
      `Track it any time: ${env.SITE_URL}/track?q=${done.id}`, '',
      link.note ? `From ${account.business_name}: ${link.note}` : null,
      `${store.name}, ${store.phone}. Code ${done.id}.`,
    ].filter((x) => x !== null).join('\n');
    const mock = await sendEmail(env, email, `Your return label for ${account.business_name}`, text);
    await saveOrder(env, { ...done, emailed_at: new Date().toISOString() });
    return json({ ok: true, order: done.id, carrier: rate.carrier, service: rate.service, label_url: abs(l.label_url), qr_url: abs(l.qr_url), tracking_number: l.tracking_number, mock });
  } catch (e: any) {
    return json({ error: e.message }, /needed|Missing|must be|ZIP|right now|not active/.test(e.message ?? '') ? 400 : 500);
  }
};
