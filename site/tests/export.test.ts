// Full data export: CSV shape, secrets blanked, every table present, the JSON bundle.
import { describe, it, expect } from 'vitest';
import { toCsv, everything, EXPORT_TABLES } from '../src/lib/export';
import { exportTable, exportCounts, addStaff, addAccount, upsertCustomer, addApiKey } from '../src/shipping/store';

const env = {} as any;

describe('export', () => {
  it('CSV has a header from all keys, quotes commas and quotes, and a BOM for Excel', () => {
    const csv = toCsv([{ a: 1, b: 'x,y' }, { a: 2, c: 'say "hi"' }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('a,b,c');
    expect(lines[1]).toBe('1,"x,y",');
    expect(lines[2]).toBe('2,,"say ""hi""' + '"');
  });
  it('every schema table exports, secrets are blanked, counts match', async () => {
    const staff = await addStaff(env, { name: 'Export Tester', pin_hash: 'HASH', role: 'owner' });
    const cid = (await upsertCustomer(env, { name: 'Ex Co', email: 'ex@example.com' }))!;
    const acc = await addAccount(env, { customer_id: cid, business_name: 'Ex Co', discount_percent: 0, notes: '' });
    await addApiKey(env, { account_id: acc.id, label: 'k', prefix: 'psk_', key_hash: 'KH', webhook_url: null, webhook_secret: 'WS' });
    const staffRows = await exportTable(env, 'staff');
    expect(staffRows.find((r) => r.id === staff.id)?.pin_hash).toBe('');
    const keys = await exportTable(env, 'api_keys');
    expect(keys[0].key_hash).toBe('');
    expect(keys[0].webhook_secret).toBe('');
    const counts = await exportCounts(env);
    for (const t of EXPORT_TABLES) expect(counts).toHaveProperty(t);
    expect(counts.accounts).toBeGreaterThanOrEqual(1);
    await expect(exportTable(env, 'sqlite_master' as any)).rejects.toThrow(/No such table/);
    const all = await everything(env);
    expect(Object.keys(all.tables)).toEqual([...EXPORT_TABLES]);
    expect(Array.isArray(all.orders)).toBe(true);
    expect(all.store).toMatch(/Goin' Postal/);
  });
});
