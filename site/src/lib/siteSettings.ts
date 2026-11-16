import { getSetting, setSetting, type SettingRow } from '../shipping/store';

// The owners' site switches (Peter, Nov 14 2026), flipped at /counter/settings.
//
// online_labels: does the website do shipping at all?
//   'on'  - the Ship page quotes and takes the card through Stripe, as William built it.
//   'off' - no shipping prices online: /ship shows the in-store page, /api/rates answers staff PINs only
//           (the Queue's walk-up quote), /api/orders refuses, and the home page talks about the counter.
//           The default when the switch has never been set, because the owners chose to keep online
//           labels on the sideline for now (FOR-WILLIAM D19, TODO P7/P8). Business accounts' API keys
//           (/api/v1) are not affected.
export const ONLINE_LABELS = 'online_labels';

export async function onlineLabelsOn(env: Env): Promise<boolean> {
  return (await getSetting(env, ONLINE_LABELS))?.value === 'on';
}

export async function setOnlineLabels(env: Env, on: boolean, by: string): Promise<SettingRow> {
  return setSetting(env, ONLINE_LABELS, on ? 'on' : 'off', by);
}

/** What /counter/settings shows: each switch, its value and who last changed it. */
export async function siteSettings(env: Env) {
  const row = await getSetting(env, ONLINE_LABELS);
  return { online_labels: { on: row?.value === 'on', updated_at: row?.updated_at ?? null, updated_by: row?.updated_by ?? null } };
}
