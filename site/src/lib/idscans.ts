// Scanned ID copies for the physical mailboxes (v1.77.0). USPS wants the CMRA to keep the two IDs
// behind each Form 1583 on file; a scan of each is the proof. These are the most sensitive bytes the
// store holds, so they never sit next to parcel photos with a guessable link:
//   - With AZURE_ID_SCANS_SAS set (a container SAS URL with create, read and write, on a storage
//     account the owners control, issue 19), each scan is a block blob in that private container and
//     Cloudflare keeps only the blob name.
//   - Otherwise the bytes go to the ORDERS KV namespace under a scan: key (memory on the dev server),
//     which is private to the worker and never served by URL.
// Either way the only road to a scan is the staff PIN: the counter page asks the API with the PIN and
// gets a data URL back. An on-site copy (a locked folder on the counter PC) is the same bytes pulled
// by the printer agent; that path is decision 1 in shipping-client/mailboxes/README.md.
import { newPhotoId, SCAN_MAX_BYTES } from './photos';

export type ScanStore = 'azure' | 'kv';
export interface IdScan { id: string; type: 'image/jpeg' | 'image/png' | 'application/pdf'; bytes: number; store: ScanStore }

const memory = new Map<string, ArrayBuffer>();
const KEY = (id: string) => `idscan:${id}`;
const kv = (env: Env) => env.ORDERS ?? ({ get: async (k: string, _t: 'arrayBuffer') => memory.get(k) ?? null, put: async (k: string, v: ArrayBuffer) => { memory.set(k, v); }, delete: async (k: string) => { memory.delete(k); } } as unknown as KVNamespace);

const EXT: Record<IdScan['type'], string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

/** A container SAS URL plus the blob name: https://acct.blob.core.windows.net/ids?sv=...  →  .../ids/NAME?sv=... */
export function blobUrl(sas: string, name: string): string {
  const u = new URL(sas);
  u.pathname = u.pathname.replace(/\/$/, '') + '/' + name;
  return u.toString();
}

export function decodeScan(dataUrl: string): { bytes: Uint8Array; type: IdScan['type'] } {
  const m = /^data:(image\/jpeg|image\/png|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error('The ID scan must be a JPEG, PNG or PDF');
  const bin = atob(m[2]);
  if (bin.length > SCAN_MAX_BYTES) throw new Error('That scan is too big; 4 MB is the limit');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] as IdScan['type'] };
}

export async function saveIdScan(env: Env, dataUrl: string): Promise<IdScan> {
  const { bytes, type } = decodeScan(dataUrl);
  const id = newPhotoId();
  if (env.AZURE_ID_SCANS_SAS) {
    const res = await fetch(blobUrl(env.AZURE_ID_SCANS_SAS, `${id}.${EXT[type]}`), {
      method: 'PUT', body: bytes.buffer as ArrayBuffer, signal: AbortSignal.timeout(15000),
      headers: { 'x-ms-blob-type': 'BlockBlob', 'x-ms-version': '2023-11-03', 'Content-Type': type, 'Content-Length': String(bytes.length) },
    });
    if (!res.ok) throw new Error(`Azure would not take the scan (${res.status}): check AZURE_ID_SCANS_SAS`);
    return { id, type, bytes: bytes.length, store: 'azure' };
  }
  await kv(env).put(KEY(id), bytes.buffer as ArrayBuffer);
  return { id, type, bytes: bytes.length, store: 'kv' };
}

export async function readIdScan(env: Env, scan: { scan_id: string; scan_type: string; scan_store: string }): Promise<ArrayBuffer | null> {
  if (!/^[0-9a-f]{32}$/.test(scan.scan_id)) return null;
  if (scan.scan_store === 'azure') {
    if (!env.AZURE_ID_SCANS_SAS) throw new Error('This scan is in Azure and AZURE_ID_SCANS_SAS is not set');
    const res = await fetch(blobUrl(env.AZURE_ID_SCANS_SAS, `${scan.scan_id}.${EXT[scan.scan_type as IdScan['type']] ?? 'bin'}`), { signal: AbortSignal.timeout(15000) });
    return res.ok ? res.arrayBuffer() : null;
  }
  return kv(env).get(KEY(scan.scan_id), 'arrayBuffer');
}

/** The bytes as a data URL for the counter page (it opens them in a new tab, nothing is linked by URL). */
export function toDataUrl(bytes: ArrayBuffer, type: string): string {
  let bin = '';
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}
