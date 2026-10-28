export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { getOrder } from '../../lib/orders';
import { searchCustomers, getCustomer, customerQuotes, allCustomers, logAudit } from '../../shipping/store';

// Customer lookup from /counter/customers. Staff PIN required.
//  search: { q } any part of a name, an email, or phone digits. Also returns walk-up quotes that match
//          by name but have no contact details, since those never get a customer row.
//  get:    { id } the customer, every quote newest first, and their address book (distinct destinations
//          from the orders still in KV, most recent first).
//  export: CSV of every customer, phone first, for the owners to set beside the Coupon Counter.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'search') return json(await searchCustomers(env, String(b.q ?? '')));
    if (b.action === 'get') {
      const customer = await getCustomer(env, String(b.id ?? ''));
      if (!customer) return json({ error: 'No such customer' }, 404);
      const quotes = await customerQuotes(env, customer);
      const seen = new Set<string>();
      const addresses: { order: string; at: string; to: Record<string, unknown> }[] = [];
      for (const q of quotes.slice(0, 25)) {
        const o = await getOrder(env, q.id);
        if (!o) continue;
        const d = o.destination;
        const key = `${d.contact_name}|${d.line_1}|${d.line_2 ?? ''}|${d.postal_code}`.toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(key)) continue;
        seen.add(key);
        addresses.push({ order: q.id, at: q.created_at, to: { ...d } });
      }
      return json({ customer, quotes, addresses });
    }
    if (b.action === 'export') {
      await logAudit(env, user, 'customers.export');
      const rows = await allCustomers(env);
      const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = [['phone', 'name', 'email', 'shipments', 'returning', 'first_shipment', 'last_seen', 'text_ok', 'email_ok', 'id'].join(',')];
      for (const c of rows) lines.push([c.phone, c.name, c.email, c.shipments, c.returning ? 'yes' : 'no', c.first_at?.slice(0, 10), c.last_seen_at?.slice(0, 10), c.consent_sms ? 'yes' : 'no', c.consent_email ? 'yes' : 'no', c.id].map(esc).join(','));
      return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="forsythe-customers.csv"' } });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
