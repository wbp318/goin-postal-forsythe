export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { createReturnRequest } from '../../shipping/store';

// Public: a customer says they are bringing a return (the /returns page). No payment, no PIN. The
// counter serves it from /counter/dropoff, where staff actions live in /api/dropoff.
const CARRIERS = ['Amazon', 'UPS', 'FedEx', 'USPS', 'DHL'];
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json().catch(() => ({}));
    const name = String(b.name ?? '').trim().slice(0, 60);
    if (!name) throw new Error('Your name is needed so we know who is coming');
    const phone = String(b.phone ?? '').trim().slice(0, 20);
    const email = String(b.email ?? '').trim().slice(0, 80);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('That email does not look right');
    const label = (['printed', 'print', 'qr'] as const).find((x) => x === b.label) ?? 'printed';
    const r = await createReturnRequest(env, {
      customer_name: name, phone: phone || null, email: email || null,
      carrier: CARRIERS.find((c) => c === String(b.carrier)) ?? null,
      label, box: b.box === true || b.box === 'on' || b.box === 1 ? 1 : 0,
      tracking: String(b.tracking ?? '').replace(/\s+/g, '').toUpperCase().slice(0, 40) || null,
      notes: String(b.notes ?? '').trim().slice(0, 200) || null,
    });
    return json({ code: r.code });
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
