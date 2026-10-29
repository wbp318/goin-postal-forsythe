// Pickups (T15): the store's records, the day's route order, prefill from the last one, stages.
import { describe, it, expect } from 'vitest';
import * as store from '../src/shipping/store';

const env = {} as any;
const addr = JSON.stringify({ contact_name: 'Pick Co', line_1: '1 Main St', city: 'Monroe', state: 'LA', postal_code: '71201', country_alpha2: 'US' });

describe('pickups', () => {
  it('schedules, orders a day morning first, prefills from the last, and moves through the stages', async () => {
    const cid = (await store.upsertCustomer(env, { name: 'Pick Co', email: 'pick@example.com' }))!;
    const account = await store.addAccount(env, { customer_id: cid, business_name: 'Pick Co', discount_percent: 0, notes: '' });
    const base = { account_id: account.id, account_name: 'Pick Co', address_json: addr, phone: '318-555-0100', notes: null, fee_usd: 0, by_name: 'Tester' };
    const pm = await store.createPickup(env, { ...base, code: 'PU-TEST02', scheduled_date: '2099-01-02', window: 'afternoon', packages: 3 });
    const am = await store.createPickup(env, { ...base, code: 'PU-TEST01', scheduled_date: '2099-01-02', window: 'morning', packages: 5 });
    expect(store.newPickupCode()).toMatch(/^PU-[A-Z2-9]{6}$/);
    expect((await store.listPickups(env, '2099-01-02')).map((p) => p.code)).toEqual([am.code, pm.code]);
    expect((await store.lastPickupFor(env, account.id))?.code).toBe(am.code);
    const otw = await store.updatePickup(env, 'pu-test01', { status: 'on_the_way', on_the_way_at: '2099-01-02T08:00:00Z', driver: 'Sam', texted_at: '2099-01-02T08:00:00Z' });
    expect(otw?.status).toBe('on_the_way');
    const done = await store.updatePickup(env, am.code, { status: 'picked_up', picked_up_at: '2099-01-02T08:30:00Z', packages: 4 });
    expect(done).toMatchObject({ status: 'picked_up', packages: 4, driver: 'Sam' });
    expect((await store.pickupsForAccount(env, account.id)).map((p) => p.code)).toEqual([am.code, pm.code]);
    expect(await store.updatePickup(env, 'PU-NOPE', { notes: 'x' })).toBeNull();
  });
});
