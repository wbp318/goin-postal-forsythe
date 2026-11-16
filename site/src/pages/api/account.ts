export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json, parseAddress } from '../../lib/validate';
import { listSavedDesigns, getSavedDesign, saveSavedDesign, deleteSavedDesign, SAVED_PRODUCTS, type SavedProduct } from '../../shipping/store';
import { designForSaving, cardName, cleanPicks, cleanQuantity } from '../../lib/savedCards';
import { createLoginToken, readSession, clearCookie, safeNext, createSignupToken, signSession, sessionCookie, endSessions } from '../../lib/session';
import { overLimit, resetLimit } from '../../lib/limits';
import { hashPassword, verifyPassword, passwordProblem } from '../../lib/password';
import { getLogin, setPasswordHash } from '../../shipping/store';
import { sendEmail } from '../../shipping/notify';
import { store } from '../../data/store';
import { phoneHolder } from '../../shipping/store';
import { upsertCustomer, getCustomer, findCustomer, saveCustomerAddress, deleteCustomerAddress, setCustomerName, normalizePhone, logAudit } from '../../shipping/store';
import { getOrder, saveOrder } from '../../lib/orders';
import { recordConsent } from '../../shipping/store';
import { isChannel, loggedWording } from '../../lib/consent';

// Customer accounts (T20). login { email } emails a magic link; the rest need the session cookie:
// name { name }, save_address { label, address }, delete_address { id }, logout.
// Who is signed in, for the header's Log in button (Peter, Nov 14 2026). First name only; nothing else leaves.
export const GET: APIRoute = async ({ request }) => {
  const id = await readSession(env, request.headers.get('cookie')).catch(() => null);
  const c = id ? await getCustomer(env, id) : null;
  const first = c ? (c.name && c.name !== 'Customer' ? c.name.split(/\s+/)[0] : '') : '';
  return new Response(JSON.stringify(c ? { signed_in: true, name: first } : { signed_in: false }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
};

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  try {
    if (b.action === 'login') {
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is needed' }, 400);
      // The record is made on first login so the link has somewhere to land; the name comes from the first order or the account page.
      const existing = await findCustomer(env, email, null);
      if (!existing) await upsertCustomer(env, { name: String(b.name ?? '').trim().slice(0, 60) || 'Customer', email });
      const token = await createLoginToken(env, email);
      // next: the page to come back to after the link is clicked (the ship page keeps the customer's form meanwhile).
      const next = safeNext(b.next);
      const link = `${env.SITE_URL}/account?token=${token}${next !== '/account' ? `&next=${encodeURIComponent(next)}` : ''}`;
      const mock = await sendEmail(env, email, `Sign in to ${store.name}`, `Click to sign in to your ${store.name} account (the link works once, for fifteen minutes):\n\n${link}\n\nIf you did not ask for this, ignore it.`);
      return json({ ok: true, sent: true, ...(mock ? { mock_link: link } : {}) });
    }
    // Password sign-in (Peter, Nov 14 2026). The same answer whether the email is unknown or the password wrong.
    // Every try counts before the password is checked: five an email from one address, thirty from one address,
    // twenty an email from everywhere; fifteen minutes each. The email link always works.
    if (b.action === 'password_login') {
      const email = String(b.email ?? '').trim().toLowerCase();
      const ip = request.headers.get('cf-connecting-ip') ?? 'local';
      const over = await Promise.all([overLimit(env, `pw:${email}:${ip}`, 5), overLimit(env, `pwip:${ip}`, 30), overLimit(env, `pw:${email}`, 20)]);
      if (over.some(Boolean)) return json({ error: 'Too many tries. Wait 15 minutes, or use the email link.', code: 'locked' }, 429);
      const c = email ? await findCustomer(env, email, null) : null;
      const login = c ? await getLogin(env, c.id) : null;
      const ok = login?.pw_hash ? await verifyPassword(String(b.password ?? ''), { hash: login.pw_hash, salt: login.pw_salt!, iter: login.pw_iter ?? 0 }) : (await hashPassword('timing-equaliser'), false);
      if (!c || !ok) return json({ error: 'Email or password is wrong.', code: 'bad_login' }, 401);
      await resetLimit(env, `pw:${email}:${ip}`);
      await resetLimit(env, `pw:${email}`);
      const secure = new URL(request.url).protocol === 'https:';
      return new Response(JSON.stringify({ ok: true, next: safeNext(b.next) }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(await signSession(env, c.id), secure) } });
    }
    // Create an account, or put a password on an existing email: the password waits inside a link sent to the
    // email, and is set only when the link is opened. Same reply whatever the email, so nobody learns who has an account.
    if (b.action === 'signup') {
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is needed' }, 400);
      // A mobile number is asked for at sign-up (Peter, Nov 15 2026), so the store can call or text about an order.
      const phone = normalizePhone(String(b.phone ?? ''));
      if (!phone) return json({ error: 'Enter your mobile number (10 digits).', code: 'phone' }, 400);
      const problem = passwordProblem(String(b.password ?? ''), email);
      if (problem) return json({ error: 'Use at least 8 characters, and not a common password.', code: `pw_${problem}` }, 400);
      const ip = request.headers.get('cf-connecting-ip') ?? 'local';
      // Counts sign-ups from one address, so the form can't be used to flood inboxes.
      if (await overLimit(env, `su:${ip}`, 20)) return json({ error: 'Too many tries. Wait 15 minutes.', code: 'locked' }, 429);
      const pw = await hashPassword(String(b.password)); // hashed whatever the email, so every reply takes as long
      const next = safeNext(b.next);
      const nextQ = next !== '/account' ? `&next=${encodeURIComponent(next)}` : '';
      // A sign-up only ever makes a new account. An email that has one already gets a sign-in link instead, and
      // nothing on the account changes; the reply is the same, so nobody learns who has an account.
      if (await findCustomer(env, email, null)) {
        const link = `${env.SITE_URL}/account?token=${await createLoginToken(env, email)}${nextQ}`;
        const mock = await sendEmail(env, email, `Your ${store.name} account`, `Someone asked to create a ${store.name} account with this email. There is one already, so nothing was changed.\n\nTo sign in, use this link (it works once, for fifteen minutes):\n\n${link}\n\nOnce you're in, you can set a password under Profile. If you did not ask for this, ignore it.`);
        return json({ ok: true, sent: true, ...(mock ? { mock_link: link } : {}) });
      }
      // Deals and news chosen on the sign-up form (Peter, Nov 15 2026). Shown again on the Confirm page and recorded
      // with their wording only when the person with the email confirms.
      const mkt = { email: b.mkt_email === true, sms: b.mkt_sms === true, lang: String(b.lang ?? 'en').slice(0, 5) };
      const token = await createSignupToken(env, email, { pw, name: String(b.name ?? '').trim().slice(0, 60) || undefined, phone, mkt });
      const link = `${env.SITE_URL}/account?token=${token}${nextQ}`;
      const mock = await sendEmail(env, email, `Confirm your email for ${store.name}`, `Click to confirm your email and finish setting up your ${store.name} account (the link works once, for thirty minutes):\n\n${link}\n\nIf you did not ask for this, ignore it; nothing changes.`);
      return json({ ok: true, sent: true, ...(mock ? { mock_link: link } : {}) });
    }
    if (b.action === 'logout') return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie() } });
    const id = await readSession(env, request.headers.get('cookie'));
    const c = id ? await getCustomer(env, id) : null;
    if (!c) return json({ error: 'Sign in first' }, 401);
    if (b.action === 'name') {
      const name = String(b.name ?? '').trim().slice(0, 60);
      if (!name) return json({ error: 'A name is needed' }, 400);
      const phone = String(b.phone ?? '').trim().slice(0, 20);
      // A number already on another customer's record stays theirs; the counter can sort out a real mix-up.
      if (phone && await phoneHolder(env, phone, c.id)) return json({ error: 'That number is on file for another customer. Ask us at the counter to change it.', code: 'phone_taken' }, 409);
      await setCustomerName(env, c.id, name, phone ? normalizePhone(phone) : null);
      return json({ ok: true });
    }
    // Marketing choices on the account page (Peter, Nov 14 2026): a yes or a no, each logged with the wording shown.
    if (b.action === 'consent') {
      if (!isChannel(b.channel)) return json({ error: 'Unknown choice' }, 400);
      const granted = b.granted === true;
      const contact = b.channel === 'email' ? c.email : c.phone;
      if (granted && !contact) return json({ error: b.channel === 'sms' ? 'Add your mobile number first' : 'Add your email first' }, 400);
      await recordConsent(env, { customer_id: c.id, channel: b.channel, granted, contact, wording: loggedWording(b.channel, b.lang), source: 'account_page' });
      return json({ ok: true });
    }
    // Set or change the password while signed in (also how "forgot password" ends: sign in by link, then set a new one).
    if (b.action === 'set_password') {
      const problem = passwordProblem(String(b.password ?? ''), c.email ?? '');
      if (problem) return json({ error: 'Use at least 8 characters, and not a common password.', code: `pw_${problem}` }, 400);
      await setPasswordHash(env, c.id, await hashPassword(String(b.password)));
      // A new password signs out every other device; this one gets a fresh cookie and stays signed in.
      await endSessions(env, c.id);
      await logAudit(env, { id: null, name: `customer ${c.id}` }, 'customer.password', c.id).catch(() => {});
      const secure = new URL(request.url).protocol === 'https:';
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessionCookie(await signSession(env, c.id), secure) } });
    }
    if (b.action === 'save_address') {
      const address = parseAddress({ ...b.address, country_alpha2: b.address?.country_alpha2 || 'US' });
      const row = await saveCustomerAddress(env, { customer_id: c.id, label: String(b.label ?? '').trim().slice(0, 40) || address.contact_name, address_json: JSON.stringify(address) });
      return json({ ok: true, address: row });
    }
    if (b.action === 'resend_label') {
      // The customer's own labeled order, emailed again to the account's address. Same text the counter sends.
      const o = await getOrder(env, String(b.order ?? '').toUpperCase());
      if (!o || (o.email ?? '').toLowerCase() !== (c.email ?? '').toLowerCase()) return json({ error: 'No such order on this account' }, 404);
      if (!o.label || (o.status !== 'labeled' && o.status !== 'printed')) return json({ error: 'That order has no label to send' }, 400);
      const l = o.label;
      const abs = (u: string | null | undefined) => (u ? (u.startsWith('/') ? `${env.SITE_URL}${u}` : u) : null);
      const isReturn = o.kind === 'return';
      const lines = [
        isReturn ? `Here is your prepaid return label from ${store.name}.` : `Here is your shipping label from ${store.name}.`, '',
        (o.rate.service.toLowerCase().startsWith(o.rate.carrier.toLowerCase()) ? o.rate.service : `${o.rate.carrier} ${o.rate.service}`) + (l.tracking_number ? `, tracking number ${l.tracking_number}.` : '.'),
        abs(l.label_url) ? `Label (print on plain paper and tape it flat to the box): ${abs(l.label_url)}` : null,
        abs(l.qr_url) ? `No printer? Show this code at any ${o.rate.carrier} location and they print it: ${abs(l.qr_url)}` : null, '',
        `Track it any time: ${env.SITE_URL}/track?q=${o.id}`, '', `${store.name}, ${store.address}, ${store.phone}. Pickup code ${o.id}.`,
      ].filter((x) => x !== null);
      const mock = await sendEmail(env, c.email!, `${isReturn ? 'Your return label' : 'Your shipping label'} ${o.id}`, lines.join('\n'));
      await saveOrder(env, { ...o, emailed_at: new Date().toISOString() });
      await logAudit(env, { id: null, name: `Customer ${c.name}` }, 'label.email', o.id, `${c.email} (from the account page)`);
      return json({ ok: true, mock });
    }
    // Saved designs (Peter, Nov 15 2026): only ever this customer's own. Business cards today; the other printed
    // products use the same actions with their product name once they're ordered online.
    const product = (SAVED_PRODUCTS as string[]).includes(String(b.product ?? 'card')) ? (String(b.product ?? 'card') as SavedProduct) : null;
    if (b.action === 'designs_list') {
      const rows = await listSavedDesigns(env, c.id, product ?? undefined);
      return json({ designs: rows.map((r) => ({ id: r.id, product: r.product, name: r.name, updated_at: r.updated_at, last_quantity: r.last_quantity, last_options: r.last_options_json ? JSON.parse(r.last_options_json) : null, last_ordered_at: r.last_ordered_at })) });
    }
    if (b.action === 'design_get') {
      const r = await getSavedDesign(env, c.id, Number(b.id));
      if (!r) return json({ error: 'No such design on this account' }, 404);
      const design = JSON.parse(r.design_json);
      const card = r.product === 'card';
      return json({ design: { id: r.id, product: r.product, name: r.name, design, quantity: card ? cleanQuantity(r.last_quantity) : r.last_quantity, options: card ? cleanPicks(r.last_options_json ? JSON.parse(r.last_options_json) : {}) : (r.last_options_json ? JSON.parse(r.last_options_json) : {}) } });
    }
    if (b.action === 'design_save') {
      if (product !== 'card') return json({ error: 'Saving this product online is not available yet' }, 400);
      const { design, json: dj } = designForSaving(b.design);
      const r = await saveSavedDesign(env, { customer_id: c.id, product, id: Number(b.id) || null, name: cardName(design, b.name), design_json: dj });
      return json({ ok: true, id: r.id, name: r.name });
    }
    if (b.action === 'design_delete') {
      const ok = await deleteSavedDesign(env, c.id, Number(b.id));
      return ok ? json({ ok: true }) : json({ error: 'No such design on this account' }, 404);
    }
    if (b.action === 'delete_address') {
      const ok = await deleteCustomerAddress(env, c.id, Number(b.id));
      return ok ? json({ ok: true }) : json({ error: 'No such address' }, 404);
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, /Missing|must be|needed|too many|up to/.test(e.message ?? '') ? 400 : 500);
  }
};
