export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { getOrder } from '../../lib/orders';
import { queuePrint, nextPrintJob, markPrinted, pendingPrintJobs } from '../../shipping/store';

// The print queue. Two callers:
//  - staff on the counter page: POST { pin, action: "queue", order } puts the order's label in the queue.
//  - the printer agent (shipping-client/printer-agent): GET ?printer=counter with header X-Printer-Key
//    takes the oldest unprinted job; POST { action: "done", id } with the same header marks it printed.
const agentOk = (request: Request) => !!env.PRINTER_KEY && request.headers.get('x-printer-key') === env.PRINTER_KEY;

export const GET: APIRoute = async ({ request, url }) => {
  if (!agentOk(request)) return json({ error: 'Bad printer key' }, 403);
  try {
    if (url.searchParams.get('all')) return json({ jobs: await pendingPrintJobs(env) });
    return json({ job: await nextPrintJob(env, url.searchParams.get('printer') ?? 'counter') });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  try {
  if (b.action === 'done') {
    if (!agentOk(request)) return json({ error: 'Bad printer key' }, 403);
    await markPrinted(env, Number(b.id));
    return json({ ok: true });
  }
  if (b.action === 'queue') {
    if (!env.COUNTER_PIN || String(b.pin) !== env.COUNTER_PIN) return json({ error: 'Wrong PIN' }, 403);
    const order = await getOrder(env, String(b.order ?? ''));
    if (!order?.label) return json({ error: 'No label to print yet' }, 400);
    const l = order.label;
    const pdf = l.label_url && l.label_url.startsWith('/') ? `${env.SITE_URL}${l.label_url}` : l.label_url; // the agent fetches it from outside
    const job = l.label_zpl ? { kind: 'label_zpl' as const, payload: l.label_zpl } : pdf ? { kind: 'label_pdf' as const, payload: pdf } : null;
    if (!job) return json({ error: 'Label has no printable file' }, 400);
    const id = await queuePrint(env, { shipment_id: order.id, ...job, printer: String(b.printer ?? 'counter') });
    return json({ ok: true, id, kind: job.kind, agent: !!env.PRINTER_KEY });
  }
  return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
