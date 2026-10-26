export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { findShipment, listTrackingEvents, addTrackingEvents } from '../../shipping/store';
import { track } from '../../shipping/engine';
import { notifyEvents } from '../../shipping/notify';

const REFRESH_AFTER_MS = 15 * 60_000;

// Public tracking: GET /api/track?q=GP-XXXXXX or ?q=<tracking number>. No login.
// Returns only what a stranger holding the tracking number could already learn from the carrier's own site.
// Pulls fresh events from the carrier when the stored ones are older than fifteen minutes.
export const GET: APIRoute = async ({ url }) => {
  try {
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 4 || q.length > 40) return json({ error: 'Enter a pickup code or tracking number' }, 400);
  const s = await findShipment(env, q);
  if (!s) return json({ error: 'Not found' }, 404);

  let events = await listTrackingEvents(env, s.id);
  const stale = !events.length || Date.now() - new Date(s.updated_at).getTime() > REFRESH_AFTER_MS;
  const done = s.status === 'delivered' || s.status === 'voided';
  if (stale && !done && s.label_id && s.tracking_number) {
    try {
      const fresh = await track(env, s.label_id, s.tracking_number);
      const added = await addTrackingEvents(env, s.id, fresh);
      if (added.length) {
        events = await listTrackingEvents(env, s.id);
        await notifyEvents(env, s, added).catch((e) => console.warn('notify failed', s.id, e.message));
      }
    } catch (e: any) {
      console.warn('track refresh failed', s.id, e.message);
    }
  }
  const dest = JSON.parse(s.destination_json);
  const latest = events[0];
  return json({
    id: s.id, carrier: s.carrier, service: s.service, tracking_number: s.tracking_number,
    status: latest && latest.status !== 'label_created' ? latest.status : s.status,
    to: `${dest.city}, ${dest.state} ${dest.postal_code}`.trim(),
    events,
  });
  } catch (e: any) {
    console.error('track', e);
    return json({ error: 'Tracking is unavailable right now. Try again in a minute.' }, 500);
  }
};
