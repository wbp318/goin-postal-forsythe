// Package intake photos (to-do T17). Staff photograph the item before it is packed, from the counter
// tablet's camera or a file; the page shrinks it to 1280 px JPEG in the browser. The bytes go to the
// ORDERS KV namespace (memory on the dev server without one) under an unguessable id; the row with
// who, when and a caption goes to D1 so the order page, the claim page and the export can list them.
import { addPhotoRow, listPhotoRows, deletePhotoRow, type PhotoRow } from '../shipping/store';

export const MAX_BYTES = 600_000;
const memory = new Map<string, ArrayBuffer>();
const kv = (env: Env) => env.ORDERS ?? ({ get: async (k: string, _t: 'arrayBuffer') => memory.get(k) ?? null, put: async (k: string, v: ArrayBuffer) => { memory.set(k, v); }, delete: async (k: string) => { memory.delete(k); } } as unknown as KVNamespace);
const KEY = (id: string) => `photo:${id}`;

export function newPhotoId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Checks the data URL is a JPEG or PNG under the limit and returns its bytes. */
export function decodeImage(dataUrl: string): { bytes: Uint8Array; type: 'image/jpeg' | 'image/png' } {
  const m = /^data:(image\/jpeg|image\/png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error('The photo must be a JPEG or PNG');
  const bin = atob(m[2]);
  if (bin.length > MAX_BYTES) throw new Error('That photo is too big; the page should have shrunk it');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] as 'image/jpeg' | 'image/png' };
}

export async function savePhoto(env: Env, x: { shipment_id: string; dataUrl: string; caption: string; by_name: string }): Promise<PhotoRow> {
  const { bytes, type } = decodeImage(x.dataUrl);
  const id = newPhotoId();
  await kv(env).put(KEY(id), bytes.buffer as ArrayBuffer, { expirationTtl: 60 * 60 * 24 * 365 });
  return addPhotoRow(env, { id, shipment_id: x.shipment_id, content_type: type, bytes: bytes.length, caption: x.caption.slice(0, 120) || null, by_name: x.by_name });
}
export async function readPhoto(env: Env, id: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const rows = await listPhotoRows(env, null, id);
  const bytes = await kv(env).get(KEY(id), 'arrayBuffer');
  return bytes && rows[0] ? { bytes, type: rows[0].content_type } : null;
}
export const listPhotos = (env: Env, shipmentId: string) => listPhotoRows(env, shipmentId);
export async function deletePhoto(env: Env, id: string): Promise<boolean> {
  const ok = await deletePhotoRow(env, id);
  if (ok) await kv(env).delete(KEY(id));
  return ok;
}
