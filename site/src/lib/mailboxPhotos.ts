// Photos of mail as it comes in (Peter, Nov 16 2026): the package label, or a certified or important letter.
// The counter tablet shrinks the photo to 1280 px JPEG before sending it. The bytes go to the ORDERS KV namespace
// (memory on a dev server without one) under mbphoto:<random id> and delete themselves after 90 days, so the store
// doesn't keep pictures of people's mail forever; the row in mailbox_photos says which piece it belongs to.
// The holder sees their own photos on their dashboard (signed in); staff see them in the Edit window.
import { decodeImage } from './photos';
import { addMailboxPhoto, getMailboxPhoto, deleteMailboxPhotosForItem, type MailboxPhoto, type MailboxItem } from '../shipping/store';

export const KEEP_DAYS = 90;
const memory = new Map<string, ArrayBuffer>();
const kv = (env: Env) => env.ORDERS ?? ({ get: async (k: string) => memory.get(k) ?? null, put: async (k: string, v: ArrayBuffer) => { memory.set(k, v); }, delete: async (k: string) => { memory.delete(k); } } as unknown as KVNamespace);
const KEY = (id: string) => `mbphoto:${id}`;
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');

/** Checks the photo first (JPEG or PNG, under the size limit), so a bad one is refused before the piece is logged. */
export const checkPhoto = (dataUrl: string) => decodeImage(dataUrl);

export async function savePiecePhoto(env: Env, item: MailboxItem, dataUrl: string, byName: string): Promise<MailboxPhoto> {
  const { bytes } = decodeImage(dataUrl);
  const id = newId();
  await kv(env).put(KEY(id), bytes.buffer as ArrayBuffer, { expirationTtl: KEEP_DAYS * 86_400 });
  return addMailboxPhoto(env, { id, item_id: item.id, mailbox_id: item.mailbox_id, customer_id: item.customer_id, bytes: bytes.length, by_name: byName });
}

/** The photo and who it belongs to, or null if the id is unknown or the 90 days are up. */
export async function readPiecePhoto(env: Env, id: string): Promise<{ row: MailboxPhoto; bytes: ArrayBuffer } | null> {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const row = await getMailboxPhoto(env, id);
  const bytes = row ? await kv(env).get(KEY(id), 'arrayBuffer') : null;
  return row && bytes ? { row, bytes } : null;
}

export async function deletePiecePhotos(env: Env, itemId: number) {
  for (const id of await deleteMailboxPhotosForItem(env, itemId)) await kv(env).delete(KEY(id));
}
