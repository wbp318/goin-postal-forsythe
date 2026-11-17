export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { readSession } from '../../lib/session';
import { readPiecePhoto } from '../../lib/mailboxPhotos';

// A photo of a piece of the holder's mail (Peter, Nov 16 2026), for the <img> on their dashboard. Only the signed-in
// holder of that box gets it; anyone else (or an unknown or expired id) gets 404. Staff see photos through
// /api/mailbox (action photo, with the PIN). Never cached by shared caches, never indexed.
export const GET: APIRoute = async ({ url, request }) => {
  const me = await readSession(env, request.headers.get('cookie')).catch(() => null);
  const p = me ? await readPiecePhoto(env, url.searchParams.get('id') ?? '') : null;
  if (!p || p.row.customer_id !== me) return new Response('Not found', { status: 404 });
  const head = new Uint8Array(p.bytes.slice(0, 4));
  const type = head[0] === 0x89 && head[1] === 0x50 ? 'image/png' : 'image/jpeg';
  return new Response(p.bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Robots-Tag': 'noindex' } });
};
