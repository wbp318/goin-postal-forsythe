export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate, CAN } from '../../lib/auth';
import { listAccounts, getAccount, addAccount, updateAccount, accountOpenShipments, saveStatement, listStatements, markStatementPaid, getCustomer, searchCustomers, upsertCustomer, logAudit } from '../../shipping/store';
import { createInvoice } from '../../lib/stripe';
import { sendEmail } from '../../shipping/notify';
import { store } from '../../data/store';

// Business accounts, from /counter/accounts and the walk-up form. Any staff member can list accounts
// (to bill a walk-up to one); creating, changing and issuing statements need a manager or owner.
//  list:      active accounts with this month's unbilled total.
//  get:       { id } the account, its customer, unbilled shipments and past statements.
//  add:       { customer_id | name,email,phone, business_name, discount_percent, notes }.
//  update:    { id, business_name?, discount_percent?, notes?, active? }.
//  statement: { id, period } sums the unbilled shipments up to the end of that YYYY-MM month, saves
//             the statement, raises a Stripe invoice when a key exists, and emails the account.
//  paid:      { statement_id } marks a statement paid (by card, cheque or cash outside Stripe).
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'list') return json({ accounts: await listAccounts(env) });
    if (b.action === 'get') {
      const a = await getAccount(env, Number(b.id));
      if (!a) return json({ error: 'No such account' }, 404);
      return json({ account: a, customer: await getCustomer(env, a.customer_id), unbilled: await accountOpenShipments(env, a), statements: await listStatements(env, a.id) });
    }
    if (!CAN.audit(user)) return json({ error: 'Business accounts are managed by managers and owners' }, 403);
    if (b.action === 'add') {
      let customerId = String(b.customer_id ?? '');
      if (!customerId) {
        const name = String(b.name ?? '').trim();
        if (!name) throw new Error('A contact name is needed');
        customerId = (await upsertCustomer(env, { name, email: b.email, phone: b.phone })) ?? '';
        if (!customerId) throw new Error('An email or a mobile number is needed to open an account');
      }
      const business = String(b.business_name ?? '').trim().slice(0, 80);
      if (!business) throw new Error('A business name is needed');
      const discount = Number(b.discount_percent ?? 0);
      if (!Number.isFinite(discount) || discount < 0 || discount > 50) throw new Error('Discount must be between 0 and 50 percent');
      if ((await listAccounts(env, true)).some((a) => a.customer_id === customerId)) throw new Error('That customer already has an account');
      const a = await addAccount(env, { customer_id: customerId, business_name: business, discount_percent: Math.round(discount * 10) / 10, notes: String(b.notes ?? '').slice(0, 300) });
      await logAudit(env, user, 'account.add', String(a.id), `${business}, ${a.discount_percent}% off`);
      return json({ ok: true, account: a });
    }
    if (b.action === 'update') {
      const patch: any = {};
      if (b.business_name != null) patch.business_name = String(b.business_name).trim().slice(0, 80);
      if (b.discount_percent != null) { const d = Number(b.discount_percent); if (!Number.isFinite(d) || d < 0 || d > 50) throw new Error('Discount must be between 0 and 50 percent'); patch.discount_percent = Math.round(d * 10) / 10; }
      if (b.notes != null) patch.notes = String(b.notes).slice(0, 300);
      if (b.active != null) patch.active = b.active ? 1 : 0;
      const ok = await updateAccount(env, Number(b.id), patch);
      if (!ok) return json({ error: 'No such account' }, 404);
      await logAudit(env, user, 'account.update', String(b.id), Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(', '));
      return json({ ok: true, account: await getAccount(env, Number(b.id)) });
    }
    if (b.action === 'statement') {
      const a = await getAccount(env, Number(b.id));
      if (!a) return json({ error: 'No such account' }, 404);
      const period = String(b.period ?? new Date().toISOString().slice(0, 7));
      if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Period must be YYYY-MM');
      const cutoff = `${period}-31T23:59:59.999Z`;
      const lines = (await accountOpenShipments(env, a)).filter((s) => s.created_at <= cutoff);
      if (!lines.length) throw new Error('Nothing to bill for that month');
      const total = Math.round(lines.reduce((x, s) => x + s.total, 0) * 100) / 100;
      const customer = await getCustomer(env, a.customer_id);
      const description = `${store.name}: shipping account ${a.business_name}, ${period}, ${lines.length} shipments`;
      const inv = await createInvoice(env, { email: customer?.email ?? null, name: a.business_name, amount: total, description });
      const st = await saveStatement(env, { account_id: a.id, period, total, lines, stripe_invoice_id: inv?.id ?? null, stripe_invoice_url: inv?.url ?? null });
      let emailed = false;
      if (customer?.email) {
        const text = [`${a.business_name}: your ${store.name} shipping statement for ${period}.`, '', ...lines.map((s) => `${s.created_at.slice(0, 10)}  ${s.id}  ${s.carrier} ${s.service}  to ${s.to}  $${s.total.toFixed(2)}`), '', `Total $${total.toFixed(2)}`, inv?.url ? `Pay online: ${inv.url}` : 'Pay at the counter or by cheque.', '', `${store.name}, ${store.address}, ${store.phone}`].join('\n');
        await sendEmail(env, customer.email, `Shipping statement ${period}, ${a.business_name}`, text);
        emailed = true;
      }
      await logAudit(env, user, 'account.statement', String(a.id), `${a.business_name} ${period}: ${lines.length} shipments, $${total.toFixed(2)}${inv ? ', Stripe invoice' : ''}`);
      return json({ ok: true, statement: st, emailed, stripe: !!inv });
    }
    if (b.action === 'paid') {
      const ok = await markStatementPaid(env, Number(b.statement_id));
      if (!ok) return json({ error: 'No such statement' }, 404);
      await logAudit(env, user, 'account.statement.paid', String(b.statement_id));
      return json({ ok: true });
    }
    if (b.action === 'customers') return json(await searchCustomers(env, String(b.q ?? '')));
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, /needed|must be|already has|Nothing to bill|Period/.test(e.message ?? '') ? 400 : 500);
  }
};
