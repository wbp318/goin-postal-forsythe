export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { authenticate } from '../../lib/auth';
import { json } from '../../lib/validate';
import { pollTracking } from '../../shipping/poll';

// Refresh tracking for every open shipment. Called by the printer agent on its timer, by the
// scheduled GitHub Action (.github/workflows/track-poll.yml), or by staff from the exceptions page.
// Auth: header X-Printer-Key, or the staff PIN in the body.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const agent = !!env.PRINTER_KEY && request.headers.get('x-printer-key') === env.PRINTER_KEY;
  const staff = !!(await authenticate(env, b.pin));
  if (!agent && !staff) return json({ error: 'Not allowed' }, 403);
  try {
    const r = await pollTracking(env, Number(b.limit) || 50);
    if (r.errors.length) console.warn('track poll errors', JSON.stringify(r.errors));
    return json(r);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
