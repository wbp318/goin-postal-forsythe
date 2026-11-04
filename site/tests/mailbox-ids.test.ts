// Mailbox ID verification (v1.77.0): the Form 1583 rules in src/lib/mailboxIds.ts and the store rows.
import { describe, it, expect } from 'vitest';
import { ID_KINDS, NEVER_ACCEPTED, cleanId, checkId, checkIds, describeId, idExpired } from '../src/lib/mailboxIds';
import * as store from '../src/shipping/store';

const env = {} as any;
const today = '2026-11-04';
const dl = { kind: 'drivers_license', issuer: 'LA', last4: '1234', expires: '2029-04-01', shows_address: true };
const ins = { kind: 'insurance_policy', issuer: 'State Farm', last4: '9876', expires: '2027-06-30', shows_address: false };

describe('Form 1583 ID rules', () => {
  it('lists the accepted kinds and the refused ones', () => {
    expect(ID_KINDS.some((k) => k.id === 'drivers_license' && k.photo && k.address)).toBe(true);
    expect(ID_KINDS.some((k) => k.id === 'lease' && !k.photo && k.address && !k.expires)).toBe(true);
    expect(NEVER_ACCEPTED).toContain('Social Security card');
    expect(ID_KINDS.map((k) => k.id)).not.toContain('social_security');
  });
  it('accepts a license plus an insurance card', () => {
    expect(checkIds(dl, ins, today)).toEqual([]);
  });
  it('needs a photo ID first, a different second one, and one with the address', () => {
    expect(checkId({ ...ins }, 'primary', today)[0]).toMatch(/must carry a photo/);
    expect(checkIds(dl, { ...dl, last4: '0000' }, today)[0]).toMatch(/different kinds/);
    expect(checkIds({ ...dl, shows_address: false }, ins, today)[0]).toMatch(/current home address/);
    expect(checkIds({ kind: 'passport', issuer: 'US', last4: '1111', expires: '2030-01-01', shows_address: true }, ins, today)[0]).toMatch(/does not show a home address/);
  });
  it('refuses an expired or undated ID and an unknown kind', () => {
    expect(checkId({ ...dl, expires: '2026-11-03' }, 'primary', today)[0]).toMatch(/expired 2026-11-03/);
    expect(checkId({ ...dl, expires: '' }, 'primary', today)[0]).toMatch(/YYYY-MM-DD/);
    expect(checkId({ ...dl, issuer: '' }, 'primary', today)[0]).toMatch(/who issued it/);
    expect(checkId({ ...dl, kind: 'social_security' }, 'primary', today)[0]).toMatch(/pick what it is/);
    expect(checkId({ kind: 'lease', issuer: 'Smith Rentals', last4: '', expires: '', shows_address: true }, 'secondary', today)).toEqual([]);
  });
  it('tidies a form body and keeps only the last four', () => {
    const c = cleanId({ kind: ' passport ', issuer: 'US', last4: '12 345 6789', expires: '2030-01-01', shows_address: 'on' });
    expect(c).toEqual({ kind: 'passport', issuer: 'US', last4: '6789', expires: '2030-01-01', shows_address: true });
    expect(describeId(dl)).toBe("LA Driver's license or state ID …1234 exp 2029-04-01");
    expect(idExpired('2026-01-01', today)).toBe(true);
    expect(idExpired(null, today)).toBe(false);
  });
});

describe('mailbox ID rows', () => {
  it('keeps one live ID per slot, remembers the old one, and flags expiry for the list page', async () => {
    await store.createMailbox(env, { code: 'MB-IDTEST', customer_id: null, customer_name: 'Box Holder', email: 'ids@example.com', phone: null, business_name: null, size: 'small', term: 'monthly', price: 15 });
    await store.addMailboxId(env, { mailbox_code: 'MB-IDTEST', slot: 'primary', kind: 'drivers_license', issuer: 'LA', last4: '1234', expires: '2026-01-01', shows_address: 1, verified_by: 'Pat' });
    await store.addMailboxId(env, { mailbox_code: 'MB-IDTEST', slot: 'secondary', kind: 'insurance_policy', issuer: 'State Farm', last4: null, expires: '2028-01-01', shows_address: 0, verified_by: 'Pat' });
    expect((await store.mailboxesWithExpiredIds(env, today)).has('MB-IDTEST')).toBe(true);
    await store.addMailboxId(env, { mailbox_code: 'MB-IDTEST', slot: 'primary', kind: 'drivers_license', issuer: 'LA', last4: '5678', expires: '2032-01-01', shows_address: 1, verified_by: 'Pat' });
    const live = await store.listMailboxIds(env, 'MB-IDTEST');
    expect(live.map((i) => [i.slot, i.last4])).toEqual([['primary', '5678'], ['secondary', null]]);
    expect((await store.listMailboxIds(env, 'MB-IDTEST', true)).length).toBe(3);
    expect((await store.mailboxesWithExpiredIds(env, today)).has('MB-IDTEST')).toBe(false);
    expect(store.EXPORT_TABLES).toContain('mailbox_ids');
  });
});

describe('ID scans', () => {
  it('store in private KV (memory here) and come back as a data URL; Azure blob names come from the SAS URL', async () => {
    const { saveIdScan, readIdScan, toDataUrl, blobUrl } = await import('../src/lib/idscans');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const scan = await saveIdScan(env, png);
    expect(scan).toMatchObject({ type: 'image/png', store: 'kv' });
    const bytes = await readIdScan(env, { scan_id: scan.id, scan_type: scan.type, scan_store: scan.store });
    expect(toDataUrl(bytes!, scan.type)).toBe(png);
    await expect(saveIdScan(env, 'data:text/plain;base64,aGk=')).rejects.toThrow('JPEG, PNG or PDF');
    expect(blobUrl('https://acct.blob.core.windows.net/ids?sv=2023&sig=x', 'abc.jpg')).toBe('https://acct.blob.core.windows.net/ids/abc.jpg?sv=2023&sig=x');
  });
});
