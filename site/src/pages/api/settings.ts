export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { authenticate, atLeast } from '../../lib/auth';
import { json } from '../../lib/validate';
import { logAudit } from '../../shipping/store';
import { siteSettings, setOnlineLabels } from '../../lib/siteSettings';

// The owners' site switches, from /counter/settings (Peter, Nov 14 2026).
//  get:           every switch and who last changed it. Any staff PIN can look.
//  online_labels: turn online shipping (prices and labels) on or off ({ on: true|false }). Owner PIN only, and audited.
export const POST: APIRoute = async ({ request }) => {
  try {
    const b: any = await request.json();
    const user = await authenticate(env, String(b.pin ?? ''));
    if (!user) return json({ error: 'Wrong PIN' }, 401);
    if (b.action === 'get') return json({ settings: await siteSettings(env), can_change: atLeast(user, 'owner') });
    if (b.action === 'online_labels') {
      if (!atLeast(user, 'owner')) return json({ error: 'Only an owner PIN can change this.' }, 403);
      if (typeof b.on !== 'boolean') throw new Error('on must be true or false');
      await setOnlineLabels(env, b.on, user.name);
      await logAudit(env, { id: user.id, name: user.name }, 'settings.online_labels', b.on ? 'on' : 'off', b.on ? 'Shipping prices and labels online' : 'No shipping prices online; ship in the store');
      return json({ settings: await siteSettings(env), can_change: true });
    }
    throw new Error('Unknown action');
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
};
