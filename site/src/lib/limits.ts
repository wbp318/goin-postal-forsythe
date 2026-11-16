// Limits on tries (Nov 15 2026): sign-in, sign-up, AI designs. Every try is counted before the work is done,
// in one atomic step (bumpCounter in store.ts), so tries sent at the same moment can't all get under a limit.
import { bumpCounter, clearCounter } from '../shipping/store';

/** Counts this try against `key` and says whether it goes over `max` in the window (seconds, default 15 minutes). */
export async function overLimit(env: Env, key: string, max: number, windowSec = 15 * 60): Promise<boolean> {
  return (await bumpCounter(env, `lim:${key}`, windowSec)) > max;
}
/** Starts a key's count again, after a good sign-in. */
export const resetLimit = (env: Env, key: string) => clearCounter(env, `lim:${key}`);
