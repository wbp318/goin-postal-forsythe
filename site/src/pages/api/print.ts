export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { getOrder } from '../../lib/orders';
import { queuePrint, nextPrintJob, markPrinted, pendingPrintJobs, logAudit, markPrintFailed, clearPrintFailure, listPrintFailures, setHeartbeat, getHeartbeat } from '../../shipping/store';
import { authenticate } from '../../lib/auth';

// The print queue. Two callers:
//  - staff on the counter page: POST { pin, action: "queue", order } puts the order's label in the queue.
//  - the printer agent (shipping-client/printer-agent): GET ?printer=counter with header X-Printer-Key
//    takes the oldest unprinted job; POST { action: "done", id } with the same header marks it printed;
//    { action: "heartbeat", ... } says the agent is alive; { action: "failed", id, error, tries } sets a job aside.
//  - staff: { pin, action: "status" } for the heartbeat and the failed jobs; { pin, action: "retry", id } puts one back.
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
  if (b.action === 'heartbeat') {
    if (!agentOk(request)) return json({ error: 'Bad printer key' }, 403);
    await setHeartbeat(env, { printer: String(b.printer ?? 'counter').slice(0, 20), at: new Date().toISOString(), version: String(b.version ?? '').slice(0, 20), zebra: b.zebra ? String(b.zebra).slice(0, 60) : null, receipt: b.receipt ? String(b.receipt).slice(0, 60) : null, last_job_at: b.last_job_at ?? null, last_error: b.last_error ? String(b.last_error).slice(0, 200) : null, printed: Number(b.printed) || 0, failed: Number(b.failed) || 0 });
    return json({ ok: true });
  }
  if (b.action === 'failed') {
    if (!agentOk(request)) return json({ error: 'Bad printer key' }, 403);
    await markPrintFailed(env, Number(b.id), String(b.error ?? ''), Number(b.tries) || 0);
    return json({ ok: true });
  }
  if (b.action === 'status' || b.action === 'retry') {
    const user = await authenticate(env, b.pin);
    if (!user) return json({ error: 'Wrong PIN' }, 403);
    if (b.action === 'retry') {
      const ok = await clearPrintFailure(env, Number(b.id));
      if (!ok) return json({ error: 'No such failed job' }, 404);
      await logAudit(env, user, 'print.retry', String(b.id));
      return json({ ok: true });
    }
    const agent = await getHeartbeat(env, String(b.printer ?? 'counter'));
    return json({ agent, online: !!agent, failed: await listPrintFailures(env), key_set: !!env.PRINTER_KEY });
  }
  if (b.action === 'queue') {
    const user = await authenticate(env, b.pin);
    if (!user) return json({ error: 'Wrong PIN' }, 403);
    const order = await getOrder(env, String(b.order ?? ''));
    if (!order?.label) return json({ error: 'No label to print yet' }, 400);
    const l = order.label;
    const pdf = l.label_url && l.label_url.startsWith('/') ? `${env.SITE_URL}${l.label_url}` : l.label_url; // the agent fetches it from outside
    const job = l.label_zpl ? { kind: 'label_zpl' as const, payload: l.label_zpl } : pdf ? { kind: 'label_pdf' as const, payload: pdf } : null;
    if (!job) return json({ error: 'Label has no printable file' }, 400);
    const id = await queuePrint(env, { shipment_id: order.id, ...job, printer: String(b.printer ?? 'counter') });
    await logAudit(env, user, 'label.print', order.id, job.kind);
    return json({ ok: true, id, kind: job.kind, agent: !!env.PRINTER_KEY });
  }
  return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
