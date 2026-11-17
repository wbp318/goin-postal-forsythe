import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { upsertCustomer, addStaff, listAudit, exportTable } from '../src/shipping/store';
import { hashPin } from '../src/lib/auth';
import { storedBytes, docsReady } from '../src/lib/mailboxDocs';
import { POST } from '../src/pages/api/mailbox-docs';

// Mailbox holders' documents (Peter, Nov 16 2026): IDs and Form 1583, encrypted at rest, managers open them.
const call = async (body: Record<string, unknown>) => {
  const res = await (POST as any)({ request: new Request('http://x/api/mailbox-docs', { method: 'POST', body: JSON.stringify(body) }) });
  return { status: res.status, body: await res.json() };
};
const SECRET = 'JOHN Q CUSTOMER LA DL 0123456';
const dataUrl = (type: string, text: string) => `data:${type};base64,${btoa(text)}`;

describe('mailbox documents', () => {
  let cust = '';
  beforeAll(async () => {
    // OWNER_PIN set: the shared counter PIN 1234 is a manager; 5555 is a plain counter clerk.
    Object.assign(env as any, { COUNTER_PIN: '1234', OWNER_PIN: '9999', SITE_URL: 'https://example.com', DOCS_KEY: 'test-docs-key-long-and-random' });
    await addStaff(env as any, { name: 'Clerk Carl', pin_hash: await hashPin('5555'), role: 'counter' });
    cust = (await upsertCustomer(env as any, { name: 'Doc Holder', email: 'docs@example.com', phone: '318-555-0145' }))!;
  });

  it('any staff can upload; the stored file is locked, not readable', async () => {
    const r = await call({ pin: '5555', action: 'add', customer_id: cust, kind: 'photo_id', name: 'license.pdf', data: dataUrl('application/pdf', `%PDF-1.4 ${SECRET}`), note: 'LA license' });
    expect(r.status).toBe(200);
    const raw = new TextDecoder('latin1').decode(new Uint8Array((await storedBytes(env as any, r.body.doc.id))!));
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain('%PDF');
    const list = await call({ pin: '5555', action: 'list', customer_id: cust });
    expect(list.body.docs.map((d: any) => [d.kind, d.name, d.note])).toEqual([['photo_id', 'license.pdf', 'LA license']]);
    expect(list.body.can_open).toBe(false);
  });

  it('only a manager or owner can open or delete, and every open is logged', async () => {
    const [d] = (await call({ pin: '1234', action: 'list', customer_id: cust })).body.docs;
    expect((await call({ pin: '5555', action: 'open', id: d.id })).status).toBe(403);
    expect((await call({ pin: '5555', action: 'delete', id: d.id })).status).toBe(403);
    expect((await call({ pin: '0000', action: 'open', id: d.id })).status).toBe(401);
    const f = await call({ pin: '1234', action: 'open', id: d.id });
    expect(f.status).toBe(200);
    expect(atob(f.body.data)).toBe(`%PDF-1.4 ${SECRET}`);
    expect(f.body.content_type).toBe('application/pdf');
    const opens = (await listAudit(env as any)).filter((a) => a.action === 'mailbox.doc_open');
    expect(opens.length).toBe(1);
    expect(opens[0].staff_name).toBe('Counter (shared PIN)');
    expect((await call({ pin: '9999', action: 'delete', id: d.id })).status).toBe(200);
    expect((await call({ pin: '9999', action: 'list', customer_id: cust })).body.docs).toEqual([]);
    expect(await storedBytes(env as any, d.id)).toBeNull();
  });

  it('refuses the wrong file types, kinds and sizes', async () => {
    expect((await call({ pin: '1234', action: 'add', customer_id: cust, kind: 'form_1583', name: 'x.exe', data: dataUrl('application/x-msdownload', 'MZ') })).status).toBe(400);
    expect((await call({ pin: '1234', action: 'add', customer_id: cust, kind: 'passport??', name: 'a.png', data: dataUrl('image/png', 'png') })).status).toBe(400);
    expect((await call({ pin: '1234', action: 'add', customer_id: 'C-NOPE', kind: 'other', name: 'a.png', data: dataUrl('image/png', 'png') })).status).toBe(404);
    expect((await call({ pin: '1234', action: 'add', customer_id: cust, kind: 'other', name: 'big.png', data: dataUrl('image/png', 'x'.repeat(6_000_001)) })).status).toBe(400);
  });

  it('the live site refuses uploads until DOCS_KEY is set; a dev server on localhost works without it', async () => {
    const key = (env as any).DOCS_KEY;
    (env as any).DOCS_KEY = '';
    expect(docsReady(env as any)).toBe(false);
    const r = await call({ pin: '1234', action: 'add', customer_id: cust, kind: 'other', name: 'a.png', data: dataUrl('image/png', 'png') });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/DOCS_KEY/);
    (env as any).SITE_URL = 'http://localhost:4321';
    expect(docsReady(env as any)).toBe(true);
    Object.assign(env as any, { DOCS_KEY: key, SITE_URL: 'https://example.com' });
  });

  it('is in the export, without the file itself', async () => {
    await call({ pin: '1234', action: 'add', customer_id: cust, kind: 'form_1583', name: '1583.png', data: dataUrl('image/png', SECRET) });
    const rows = await exportTable(env as any, 'mailbox_documents');
    expect(rows.length).toBe(1);
    expect(JSON.stringify(rows)).not.toContain(SECRET);
  });
});
