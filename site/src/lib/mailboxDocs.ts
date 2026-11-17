// Mailbox holders' documents (Peter, Nov 16 2026): photo IDs and the PS Form 1583.
// Staff upload a photo or PDF; it is encrypted here (AES-GCM with a key made from the DOCS_KEY secret) before it is
// stored in the ORDERS KV namespace (memory on a dev server without one), so the stored bytes are unreadable
// without DOCS_KEY. The label row (who, what, when) is in D1 (shipping/store.ts). Opening one decrypts it.
// Without DOCS_KEY the live site refuses uploads; the local dev server (npm run dev, SITE_URL on localhost) uses
// a fixed dev-only key so Peter can try it.
import { addMailboxDoc, getMailboxDoc, deleteMailboxDoc, type MailboxDocRow } from '../shipping/store';

export const MAX_BYTES = 6_000_000;
export const KINDS = ['photo_id', 'second_id', 'form_1583', 'other'] as const;
export type DocKind = (typeof KINDS)[number];
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

const memory = new Map<string, ArrayBuffer>();
const kv = (env: Env) => env.ORDERS ?? ({ get: async (k: string) => memory.get(k) ?? null, put: async (k: string, v: ArrayBuffer) => { memory.set(k, v); }, delete: async (k: string) => { memory.delete(k); } } as unknown as KVNamespace);
const KEY = (id: string) => `mbdoc:${id}`;

const isLocal = (env: Env) => !!import.meta.env.DEV && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(env.SITE_URL ?? '');
/** True when documents can be stored: DOCS_KEY is set, or this is the local dev server. */
export const docsReady = (env: Env) => !!env.DOCS_KEY || isLocal(env);

async function cryptoKey(env: Env): Promise<CryptoKey> {
  const secret: string | undefined = env.DOCS_KEY || (isLocal(env) ? 'local-dev-only-documents-key' : undefined);
  if (!secret) throw new Error('Documents are not set up yet: DOCS_KEY is missing on the live site (ask William).');
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`gp-mailbox-docs:${secret}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** Checks a data URL is an allowed type under the limit, and returns its bytes. */
export function decodeFile(dataUrl: string): { bytes: Uint8Array; type: string } {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m || !(TYPES as readonly string[]).includes(m[1])) throw new Error('The file must be a photo (JPEG, PNG, WebP) or a PDF.');
  const bin = atob(m[2]);
  if (bin.length > MAX_BYTES) throw new Error('That file is too big (6 MB at most). Take a smaller photo or scan.');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] };
}

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');

export async function saveDoc(env: Env, x: { customer_id: string; kind: DocKind; name: string; dataUrl: string; note: string; by_name: string }): Promise<MailboxDocRow> {
  const { bytes, type } = decodeFile(x.dataUrl);
  const key = await cryptoKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes as Uint8Array<ArrayBuffer>));
  const blob = new Uint8Array(12 + sealed.length); blob.set(iv); blob.set(sealed, 12);
  const id = newId();
  await kv(env).put(KEY(id), blob.buffer as ArrayBuffer);
  const name = x.name.replace(/[^\w .()-]+/g, '_').slice(0, 80) || 'document';
  return addMailboxDoc(env, { id, customer_id: x.customer_id, kind: x.kind, name, content_type: type, bytes: bytes.length, note: x.note.slice(0, 200) || null, by_name: x.by_name });
}

/** The decrypted file, or null if the id is unknown or the file is gone. */
export async function openDoc(env: Env, id: string): Promise<{ row: MailboxDocRow; bytes: Uint8Array } | null> {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const row = await getMailboxDoc(env, id);
  const blob = row ? await kv(env).get(KEY(id), 'arrayBuffer') : null;
  if (!row || !blob) return null;
  const all = new Uint8Array(blob);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await cryptoKey(env), all.slice(12));
  return { row, bytes: new Uint8Array(plain) };
}

export async function removeDoc(env: Env, id: string): Promise<MailboxDocRow | null> {
  const row = await getMailboxDoc(env, id);
  if (!row || !(await deleteMailboxDoc(env, id))) return null;
  await kv(env).delete(KEY(id));
  return row;
}

/** Read the raw stored bytes (tests use this to check nothing is stored in the clear). */
export const storedBytes = async (env: Env, id: string) => kv(env).get(KEY(id), 'arrayBuffer');
