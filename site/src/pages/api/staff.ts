export const prerender = false;
import type { APIRoute } from 'astro';
import { env } from '../../lib/env';
import { json } from '../../lib/validate';
import { authenticate, hashPin, validPin, CAN, type Role } from '../../lib/auth';
import { listStaff, addStaff, updateStaff, logAudit, listAudit } from '../../shipping/store';

// Staff and the audit log, from /counter/staff.
//  me:     who this PIN belongs to (every page can show the name).
//  list:   everyone, owner only. PIN hashes never leave the server.
//  add:    { name, pin, role }, owner only. PINs must be 4 to 8 digits and unique.
//  update: { id, name?, role?, active?, pin? }, owner only. An owner cannot deactivate or demote
//          themselves if they are the last active owner.
//  audit:  { staff_id?, limit? }, manager or owner: newest first.
const ROLES: Role[] = ['counter', 'manager', 'owner'];

export const POST: APIRoute = async ({ request }) => {
  const b: any = await request.json().catch(() => ({}));
  const user = await authenticate(env, b.pin);
  if (!user) return json({ error: 'Wrong PIN' }, 403);
  try {
    if (b.action === 'me') return json({ user });
    if (b.action === 'audit') {
      if (!CAN.audit(user)) return json({ error: 'The audit log is for managers and owners' }, 403);
      return json({ entries: await listAudit(env, { staff_id: b.staff_id ? Number(b.staff_id) : undefined, limit: Math.min(500, Number(b.limit) || 200) }) });
    }
    if (!CAN.staff(user)) return json({ error: 'Managing staff needs an owner' }, 403);
    const everyone = async () => (await listStaff(env)).map(({ pin_hash, ...s }) => s);
    if (b.action === 'list') return json({ staff: await everyone(), user });
    if (b.action === 'add') {
      const name = String(b.name ?? '').trim().slice(0, 40);
      const pin = String(b.pin_new ?? '').trim();
      const role = String(b.role ?? 'counter') as Role;
      if (!name) throw new Error('A name is needed');
      if (!validPin(pin)) throw new Error('The PIN must be 4 to 8 digits');
      if (!ROLES.includes(role)) throw new Error('Role must be counter, manager or owner');
      if (pin === env.COUNTER_PIN || pin === env.OWNER_PIN) throw new Error('That PIN is one of the shared PINs; pick another');
      const hash = await hashPin(pin);
      if ((await listStaff(env)).some((s) => s.pin_hash === hash)) throw new Error('Someone already has that PIN; pick another');
      const row = await addStaff(env, { name, pin_hash: hash, role });
      await logAudit(env, user, 'staff.add', `${row.id}`, `${name}, ${role}`);
      return json({ ok: true, staff: await everyone() });
    }
    if (b.action === 'update') {
      const id = Number(b.id);
      const all = await listStaff(env);
      const target = all.find((s) => s.id === id);
      if (!target) return json({ error: 'No such person' }, 404);
      const patch: { name?: string; role?: Role; active?: number; pin_hash?: string } = {};
      if (b.name != null) { patch.name = String(b.name).trim().slice(0, 40); if (!patch.name) throw new Error('A name is needed'); }
      if (b.role != null) { if (!ROLES.includes(b.role)) throw new Error('Role must be counter, manager or owner'); patch.role = b.role; }
      if (b.active != null) patch.active = b.active ? 1 : 0;
      if (b.pin_new != null && b.pin_new !== '') {
        const pin = String(b.pin_new).trim();
        if (!validPin(pin)) throw new Error('The PIN must be 4 to 8 digits');
        const hash = await hashPin(pin);
        if (all.some((s) => s.id !== id && s.pin_hash === hash)) throw new Error('Someone already has that PIN; pick another');
        patch.pin_hash = hash;
      }
      const losingOwner = target.role === 'owner' && target.active && ((patch.role && patch.role !== 'owner') || patch.active === 0);
      if (losingOwner && !all.some((s) => s.id !== id && s.active && s.role === 'owner') && !env.OWNER_PIN) throw new Error('That would leave no active owner; add another owner first');
      await updateStaff(env, id, patch);
      await logAudit(env, user, 'staff.update', `${id}`, Object.keys(patch).map((k) => (k === 'pin_hash' ? 'pin reset' : `${k}=${(patch as any)[k]}`)).join(', '));
      return json({ ok: true, staff: await everyone() });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e.message }, /needed|must be|pick another|no active owner/.test(e.message ?? '') ? 400 : 500);
  }
};
