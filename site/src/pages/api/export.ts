export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate, atLeast } from '../../lib/auth';
import { logAudit } from '../../shipping/store';
import { EXPORT_TABLES, csvResponse, jsonResponse, exportCounts, type ExportTable } from '../../lib/export';

// Full data export. Owner only, every download audited.
//   { pin, action: 'counts' }                 -> { tables: { name: rows } }
//   { pin, action: 'csv', table }             -> one table as CSV
//   { pin, action: 'json' }                   -> every table plus the online orders, one JSON file
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  if (!atLeast(user, 'owner')) return json({ error: 'Owner PIN needed' }, 403);
  try {
    if (b.action === 'counts') return json({ tables: await exportCounts(env) });
    if (b.action === 'csv') {
      const table = String(b.table ?? '') as ExportTable;
      if (!(EXPORT_TABLES as readonly string[]).includes(table)) return json({ error: `No such table: ${table}` }, 400);
      await logAudit(env, user, 'export.csv', table);
      return csvResponse(env, table);
    }
    if (b.action === 'json') {
      await logAudit(env, user, 'export.everything');
      return jsonResponse(env);
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};
