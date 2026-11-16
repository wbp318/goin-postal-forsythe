import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { onlineLabelsOn, setOnlineLabels, siteSettings } from '../src/lib/siteSettings';
import { exportTable, listAudit } from '../src/shipping/store';
import { POST } from '../src/pages/api/settings';

// The owners' online-labels switch (Peter, Nov 14 2026): off by default, owner PIN only, audited.
const call = async (body: Record<string, unknown>) => {
  const res = await (POST as any)({ request: new Request('http://x/api/settings', { method: 'POST', body: JSON.stringify(body) }) });
  return { status: res.status, body: await res.json() };
};

describe('online label switch', () => {
  beforeAll(() => { Object.assign(env as any, { OWNER_PIN: '9999', COUNTER_PIN: '1234' }); });

  it('is off until an owner turns it on', async () => {
    expect(await onlineLabelsOn(env as any)).toBe(false);
    expect((await siteSettings(env as any)).online_labels).toEqual({ on: false, updated_at: null, updated_by: null });
  });

  it('counter staff can look but not change it', async () => {
    const look = await call({ action: 'get', pin: '1234' });
    expect(look.status).toBe(200);
    expect(look.body.can_change).toBe(false);
    const flip = await call({ action: 'online_labels', on: true, pin: '1234' });
    expect(flip.status).toBe(403);
    expect(await onlineLabelsOn(env as any)).toBe(false);
  });

  it('a wrong PIN sees nothing', async () => {
    expect((await call({ action: 'get', pin: '0000' })).status).toBe(401);
  });

  it('an owner turns it on and off, and each change is in the audit log', async () => {
    const on = await call({ action: 'online_labels', on: true, pin: '9999' });
    expect(on.status).toBe(200);
    expect(on.body.settings.online_labels.on).toBe(true);
    expect(on.body.settings.online_labels.updated_by).toBe('Owner (shared PIN)');
    expect(await onlineLabelsOn(env as any)).toBe(true);
    await call({ action: 'online_labels', on: false, pin: '9999' });
    expect(await onlineLabelsOn(env as any)).toBe(false);
    const log = (await listAudit(env as any)).filter((a) => a.action === 'settings.online_labels');
    expect(log.map((a) => a.target)).toEqual(['off', 'on']);
  });

  it('refuses anything but true or false', async () => {
    expect((await call({ action: 'online_labels', on: 'yes', pin: '9999' })).status).toBe(400);
  });

  it('shows up in the export', async () => {
    await setOnlineLabels(env as any, true, 'Peter');
    const rows = await exportTable(env as any, 'site_settings');
    expect(rows).toEqual([expect.objectContaining({ key: 'online_labels', value: 'on', updated_by: 'Peter' })]);
  });
});

describe('with online shipping off, the website gives customers no prices', () => {
  const post = async (route: any, body: Record<string, unknown>) => {
    const res = await route({ request: new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) });
    return { status: res.status, body: await res.json() };
  };
  const quoteBody = {
    origin: { contact_name: 'A', line_1: '100 Main St', city: 'Monroe', state: 'LA', postal_code: '71201', country_alpha2: 'US' },
    destination: { contact_name: 'Sam', line_1: '500 Elm St', city: 'Dallas', state: 'TX', postal_code: '75201', country_alpha2: 'US' },
    parcel: { weight_lb: 3, length_in: 12, width_in: 10, height_in: 6 },
  };
  beforeAll(async () => { Object.assign(env as any, { OWNER_PIN: '9999', COUNTER_PIN: '1234' }); await setOnlineLabels(env as any, false, 'test'); });

  it('refuses a customer quote', async () => {
    const { POST: rates } = await import('../src/pages/api/rates');
    const r = await post(rates, quoteBody);
    expect(r.status).toBe(403);
    expect(r.body.offline).toBe(true);
    expect(r.body.rates).toBeUndefined();
  });

  it('still quotes for staff at the counter', async () => {
    const { POST: rates } = await import('../src/pages/api/rates');
    const r = await post(rates, { ...quoteBody, pin: '1234' });
    expect(r.status).toBe(200);
    expect(r.body.rates.length).toBeGreaterThan(0);
  });

  it('refuses an online order', async () => {
    const { POST: orders } = await import('../src/pages/api/orders');
    const r = await post(orders, { ...quoteBody, rate_id: 'x' });
    expect(r.status).toBe(403);
    expect(r.body.offline).toBe(true);
  });
});
