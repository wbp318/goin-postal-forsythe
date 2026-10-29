// Intake photos (T17): the data URL check, save, read back, list, delete, on the memory fallback.
import { describe, it, expect } from 'vitest';
import { decodeImage, savePhoto, readPhoto, listPhotos, deletePhoto, MAX_BYTES } from '../src/lib/photos';

const env = {} as any;
// A 1x1 PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('photos', () => {
  it('accepts JPEG and PNG data URLs under the limit and rejects the rest', () => {
    expect(decodeImage(PNG).type).toBe('image/png');
    expect(() => decodeImage('data:image/gif;base64,AAAA')).toThrow(/JPEG or PNG/);
    expect(() => decodeImage('data:image/png;base64,' + 'A'.repeat(Math.ceil(MAX_BYTES * 4 / 3) + 8))).toThrow(/too big/);
  });
  it('saves, serves, lists and deletes', async () => {
    const row = await savePhoto(env, { shipment_id: 'GP-PHOTO1', dataUrl: PNG, caption: 'before packing', by_name: 'Tester' });
    expect(row.id).toMatch(/^[0-9a-f]{32}$/);
    expect(row.bytes).toBeGreaterThan(50);
    const got = await readPhoto(env, row.id);
    expect(got?.type).toBe('image/png');
    expect(got?.bytes.byteLength).toBe(row.bytes);
    expect((await listPhotos(env, 'GP-PHOTO1')).map((p) => p.caption)).toEqual(['before packing']);
    expect(await readPhoto(env, 'nope')).toBeNull();
    expect(await deletePhoto(env, row.id)).toBe(true);
    expect(await readPhoto(env, row.id)).toBeNull();
    expect(await deletePhoto(env, row.id)).toBe(false);
  });
});
