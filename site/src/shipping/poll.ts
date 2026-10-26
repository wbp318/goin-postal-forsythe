// Tracking poll. Walks every open shipment whose record is older than the refresh window, asks the
// carrier adapter for events, stores what is new. Carriers that offer webhooks will push instead
// (Phase 4, later); until then this runs from the printer agent every few minutes and from a
// scheduled GitHub Action, both hitting POST /api/track-poll.
import { track } from './engine';
import { openShipments, addTrackingEvents, touchShipment } from './store';
import { notifyEvents } from './notify';

export const REFRESH_AFTER_MS = 15 * 60_000;

export interface PollResult { checked: number; updated: number; notified: number; skipped: number; errors: { id: string; message: string }[] }

export async function pollTracking(env: Env, limit = 50): Promise<PollResult> {
  const out: PollResult = { checked: 0, updated: 0, notified: 0, skipped: 0, errors: [] };
  const cutoff = Date.now() - REFRESH_AFTER_MS;
  const open = (await openShipments(env, 500)).filter((s) => new Date(s.updated_at).getTime() < cutoff).slice(0, limit);
  for (const s of open) {
    if (!s.label_id || !s.tracking_number) { out.skipped++; continue; }
    out.checked++;
    try {
      const events = await track(env, s.label_id, s.tracking_number);
      const added = await addTrackingEvents(env, s.id, events);
      if (added.length) {
        out.updated++;
        const sent = await notifyEvents(env, s, added).catch((e) => { out.errors.push({ id: s.id, message: `notify: ${e.message}` }); return []; });
        out.notified += sent.length;
      }
      await touchShipment(env, s.id);
    } catch (e: any) {
      out.errors.push({ id: s.id, message: String(e.message) });
    }
  }
  return out;
}
