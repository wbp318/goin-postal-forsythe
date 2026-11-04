export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { readQr } from '../../lib/qr';
import { logQrScan, qrScanStats, logAudit } from '../../shipping/store';

// "Scan their QR" at the counter (v1.80.0), from /counter/scan. PIN required.
//   read:  { text }  -> what the QR is and what to do (no row yet)
//   log:   { text?, kind, carrier?, host?, outcome, note? } -> one qr_scans row, audited
//   stats: { days? } -> the last month's scans and the turned-away counts by carrier
const OUTCOMES = ['printed', 'turned_away', 'label_emailed', 'other'] as const;
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'read') return json({ read: readQr(String(b.text ?? '')) });
    if (b.action === 'log') {
      const read = b.text ? readQr(String(b.text)) : null;
      const kind = String(b.kind ?? read?.kind ?? 'other').slice(0, 10);
      const outcome = (OUTCOMES as readonly string[]).includes(b.outcome) ? String(b.outcome) : 'other';
      const carrier = String(b.carrier ?? read?.carrier ?? '').trim().slice(0, 20) || null;
      const row = await logQrScan(env, { by_name: user.name, kind, carrier, host: read?.host ?? null, outcome, note: String(b.note ?? '').trim().slice(0, 200) || null });
      await logAudit(env, user, `qr.${outcome}`, String(row.id), [kind, carrier, read?.host].filter(Boolean).join(' '));
      return json({ ok: true, scan: row });
    }
    if (b.action === 'stats') return json(await qrScanStats(env, Math.min(365, Math.max(1, Number(b.days) || 30))));
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
