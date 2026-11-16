export const prerender = false;
import type { APIRoute } from 'astro';
import { effectiveAddons, onlineFee, salesTax } from '../../lib/addons';
import { env } from '../../lib/env';
import { authenticate } from '../../lib/auth';
import { logAudit } from '../../shipping/store';
import { sanitizeDesign, PRICES, priceCards } from '../../lib/cards';
import { newCardId, saveCardOrder, indexCardOrder, type CardOrder } from '../../lib/cardOrders';
import { json } from '../../lib/validate';
import { createCardCheckout } from '../../lib/stripe';
import { readSession } from '../../lib/session';
import { getCustomer, setCustomerName, normalizePhone, saveSavedDesign, markSavedDesignOrdered, phoneHolder } from '../../shipping/store';
import { designForSaving, cardName, cleanPicks } from '../../lib/savedCards';

// Customer orders cards (Peter, Nov 14 2026: design, then /cards/review, then Stripe's secure page, then the
// confirmation page). action "preview" prices an order for the review page without saving anything; anyone may
// ask. Placing the order needs a signed-in customer, whose account gives the pickup name, email and phone.
// Card numbers never reach this site: Stripe Checkout takes them on Stripe's own page.
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const quantity = Number(b.quantity);
    if (!PRICES[quantity]) throw new Error('Pick a quantity');
    const priced = priceCards(quantity, b.options);
    const cfg = await effectiveAddons(env);
    if (b.action === 'preview') {
      const tax = salesTax(cfg, priced.subtotal), fee = onlineFee(cfg, priced.subtotal);
      const lines = [
        { key: 'cards.unit', label: `${quantity} cards`, amount: priced.price, qty: quantity },
        ...priced.options.map((o) => ({ key: `cards.opt.${o.code}`, label: o.name, amount: o.price })),
        ...(tax ? [{ key: 'done.tax', label: 'Sales tax', amount: tax.amount }] : []),
        ...(fee ? [{ key: 'done.fee', label: 'Online fee', amount: fee.amount }] : []),
      ];
      return json({ lines, total: Math.round((priced.subtotal + (tax?.amount ?? 0) + (fee?.amount ?? 0)) * 100) / 100 });
    }
    const meId = await readSession(env, request.headers.get('cookie')).catch(() => null);
    const me = meId ? await getCustomer(env, meId) : null;
    if (!me || !me.email) return json({ error: 'Sign in to order your cards.', signin: true }, 401);
    if (b.proofed !== true) throw new Error('Tick the box to say you checked the spelling and layout');
    // Design help: we design from the customer's notes, so the notes can't be empty.
    if (priced.chosen.help === 'designhelp' && !String(b.notes ?? '').trim()) throw new Error('Tell us in the notes what you would like on your cards');
    // The account gives the pickup details; a missing name or phone is asked on the review page and saved to the account.
    const name = me.name && me.name !== 'Customer' ? me.name : String(b.customer?.name ?? '').trim().slice(0, 60);
    const newPhone = normalizePhone(String(b.customer?.phone ?? ''));
    const phone = me.phone ?? newPhone ?? '';
    if (!name) throw new Error('Your name is needed for pickup');
    if (!phone) throw new Error('Your mobile number is needed, so we can text you when the cards are ready');
    // The number is kept on the account only when it isn't already another customer's.
    const keepPhone = newPhone && !(await phoneHolder(env, newPhone, me.id)) ? newPhone : null;
    if (name !== me.name || (!me.phone && keepPhone)) await setCustomerName(env, me.id, name, me.phone ? null : keepPhone);
    const email = me.email;
    const order: CardOrder = {
      id: newCardId(),
      created_at: new Date().toISOString(),
      status: 'awaiting_payment',
      customer: { name, email, phone },
      customer_id: me.id,
      quantity,
      price: priced.price,
      options: priced.options,
      tax: salesTax(cfg, priced.subtotal),
      fee: onlineFee(cfg, priced.subtotal),
      design: sanitizeDesign(b.design),
      notes: String(b.notes ?? '').slice(0, 600),
    };
    order.total = Math.round((priced.subtotal + (order.tax?.amount ?? 0) + (order.fee?.amount ?? 0)) * 100) / 100;
    await saveCardOrder(env, order);
    await indexCardOrder(env, me.id, order.id); // shows under My orders on the account page
    // Keep the card on the customer's account (Peter, Nov 15 2026): the saved card it came from is updated,
    // otherwise a new one is added, with what was picked this time for Reorder. A card that can't be saved
    // (too many pictures, or 30 cards already kept) never stops the order.
    let saved_id: number | null = null;
    try {
      const { design, json: dj } = designForSaving(order.design);
      const row = await saveSavedDesign(env, { customer_id: me.id, product: 'card', id: Number(b.saved_id) || null, name: cardName(design, b.saved_name), design_json: dj });
      await markSavedDesignOrdered(env, me.id, row.id, { order_id: order.id, quantity, options_json: JSON.stringify(cleanPicks(b.options)) });
      saved_id = row.id;
    } catch { /* the order goes ahead */ }
    const url = await createCardCheckout(env, order);
    return json({ order_id: order.id, next: url, saved_id });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};

// Staff: mark printed or picked up.
export const PUT: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  const { getCardOrder } = await import('../../lib/cardOrders');
  const o = await getCardOrder(env, String(b.order ?? ''));
  if (!o) return json({ error: 'No such order' }, 404);
  if (b.action === 'printed' && (o.status === 'paid' || o.status === 'sent')) o.status = 'printed';
  else if (b.action === 'sent' && o.status === 'paid') { const kind = (['shop', 'trade', 'local'] as const).find((k) => k === b.printer) ?? 'trade'; o.status = 'sent'; o.printer = { kind, name: String(b.name ?? '').trim().slice(0, 60) || kind, sent_at: new Date().toISOString(), by: user.name, ref: String(b.ref ?? '').trim().slice(0, 60) || undefined }; }
  else if (b.action === 'picked_up' && (o.status === 'paid' || o.status === 'sent' || o.status === 'printed')) o.status = 'picked_up';
  else return json({ error: `Cannot ${b.action} an order that is ${o.status}` }, 400);
  await saveCardOrder(env, o);
  await logAudit(env, user, `card.${b.action}`, o.id, o.printer && b.action === 'sent' ? `${o.printer.kind} ${o.printer.name}${o.printer.ref ? ` ref ${o.printer.ref}` : ''}` : undefined);
  return json({ status: o.status });
};
