// Who is at the counter. Each staff member has their own PIN (4 to 8 digits), stored hashed in the
// staff table and managed by an owner at /counter/staff. The two shared secrets still work so nothing
// breaks on the day the table is empty: COUNTER_PIN signs in as "Counter (shared PIN)" and OWNER_PIN
// as "Owner (shared PIN)". Once everyone has a personal PIN, remove the shared secrets and every
// action in the audit log carries a real name.
import { listStaff, type StaffRow } from '../shipping/store';

export type Role = 'counter' | 'manager' | 'owner';
export interface StaffUser { id: number | null; name: string; role: Role; shared: boolean }
const RANK: Record<Role, number> = { counter: 1, manager: 2, owner: 3 };

/** SHA-256 of the PIN with a fixed prefix. PINs are short, so the real protection is that the hash never leaves the server and the staff list is tiny. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`gp-staff:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

export async function authenticate(env: Env, pinRaw: unknown): Promise<StaffUser | null> {
  const pin = String(pinRaw ?? '').trim();
  if (!pin) return null;
  if (validPin(pin)) {
    const hash = await hashPin(pin);
    const row: StaffRow | undefined = (await listStaff(env)).find((s) => s.active && s.pin_hash === hash);
    if (row) return { id: row.id, name: row.name, role: row.role as Role, shared: false };
  }
  if (env.OWNER_PIN && pin === env.OWNER_PIN) return { id: null, name: 'Owner (shared PIN)', role: 'owner', shared: true };
  // With no separate owner PIN, the shared counter PIN keeps its old power to save prices.
  if (env.COUNTER_PIN && pin === env.COUNTER_PIN) return { id: null, name: 'Counter (shared PIN)', role: env.OWNER_PIN ? 'manager' : 'owner', shared: true };
  return null;
}

/** Does this person hold at least this role? */
export const atLeast = (u: StaffUser, role: Role) => RANK[u.role] >= RANK[role];

/** What each role may do beyond ordinary counter work. */
export const CAN = {
  prices: (u: StaffUser) => atLeast(u, 'owner'),   // save price rules and add-ons
  staff: (u: StaffUser) => atLeast(u, 'owner'),    // add people, change roles, reset PINs
  audit: (u: StaffUser) => atLeast(u, 'manager'),  // read the audit log
};
