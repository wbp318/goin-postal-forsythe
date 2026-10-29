export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate } from '../../lib/auth';
import { getOrder } from '../../lib/orders';
import { savePhoto, readPhoto, listPhotos, deletePhoto } from '../../lib/photos';
import { logAudit } from '../../shipping/store';

// Intake photos (T17). POST add { pin, shipment, image (data URL), caption }, list { pin, shipment },
// delete { pin, id }. GET ?id= serves the image; the id is 32 random hex characters, which is the
// only protection an <img> tag can carry, so photos are not linked from anywhere public.
export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'list') return json({ photos: await listPhotos(env, String(b.shipment ?? '').toUpperCase()) });
    if (b.action === 'add') {
      const id = String(b.shipment ?? '').trim().toUpperCase();
      if (!(await getOrder(env, id))) return json({ error: 'No such shipment' }, 404);
      const row = await savePhoto(env, { shipment_id: id, dataUrl: String(b.image ?? ''), caption: String(b.caption ?? '').trim(), by_name: user.name });
      await logAudit(env, user, 'photo.add', id, `${row.id} ${row.bytes} bytes${row.caption ? `, ${row.caption}` : ''}`);
      return json({ ok: true, photo: row });
    }
    if (b.action === 'delete') {
      const ok = await deletePhoto(env, String(b.id ?? ''));
      if (!ok) return json({ error: 'No such photo' }, 404);
      await logAudit(env, user, 'photo.delete', String(b.id));
      return json({ ok: true });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, /must be|too big/.test(e.message ?? '') ? 400 : 500);
  }
};

export const GET: APIRoute = async ({ url }) => {
  const p = await readPhoto(env, url.searchParams.get('id') ?? '');
  if (!p) return new Response('Not found', { status: 404 });
  return new Response(p.bytes, { headers: { 'Content-Type': p.type, 'Cache-Control': 'private, max-age=3600', 'X-Robots-Tag': 'noindex' } });
};
