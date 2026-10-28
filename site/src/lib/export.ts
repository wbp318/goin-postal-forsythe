// Full data export (to-do T10). Every table the store keeps, in open formats, on demand: CSV for one
// table, or one JSON file with everything. So no store is ever locked in, and so an accountant, a
// lawyer, a buyer doing diligence or a future system gets the real records, not a report of them.
import { EXPORT_TABLES, exportTable, exportCounts, type ExportTable } from '../shipping/store';
import { listAllOrders } from './orders';
import { store } from '../data/store';

export { EXPORT_TABLES };
export type { ExportTable };

const esc = (v: unknown) => {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows to CSV with a header from the union of keys, in first-seen order. CRLF line ends, UTF-8 BOM so Excel reads accents. */
export function toCsv(rows: Record<string, unknown>[]): string {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(','));
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}

export const slug = () => store.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

/** One table as a CSV download. */
export async function csvResponse(env: Env, table: ExportTable): Promise<Response> {
  const rows = await exportTable(env, table);
  return new Response(toCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug()}-${table}-${stamp()}.csv"` } });
}

/** Everything: every table plus the online orders from KV, one JSON object, as a download. */
export async function everything(env: Env): Promise<{ exported_at: string; store: string; tables: Record<string, Record<string, unknown>[]>; orders: unknown[] }> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of EXPORT_TABLES) tables[t] = await exportTable(env, t);
  return { exported_at: new Date().toISOString(), store: store.name, tables, orders: await listAllOrders(env) };
}
export async function jsonResponse(env: Env): Promise<Response> {
  return new Response(JSON.stringify(await everything(env)), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${slug()}-everything-${stamp()}.json"` } });
}
export { exportCounts };
