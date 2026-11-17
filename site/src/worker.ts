// The site's Cloudflare Worker entry (Peter, Nov 17 2026). Pages and APIs are Astro's own handler, unchanged;
// this adds a `scheduled` handler for the daily jobs in wrangler.jsonc "triggers.crons":
//   15:00 UTC (9 am Central in winter, 10 am in summer): mailbox renewal reminders (60, 30 and 7 days before,
//   and the day after a box lapses), each sent once. Staff can still press Send due reminders on
//   /counter/mailboxes; a reminder already sent is never sent twice. Automatic renewals (card on file, renewal on)
//   on the paid-through date, and overage fees (45 cents a piece over the box's limit) charged to the card on file. Then an email to STAFF_EMAIL listing the boxes
//   whose 6-month mail hold ended (once each), so their mail goes back to the sender.
import astro from '@astrojs/cloudflare/entrypoints/server';
import { sendDueReminders, holdEndNotices, autoRenewals, billOverages, packageJobs } from './lib/mailboxJobs';

export default {
  fetch: astro.fetch,
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(sendDueReminders(env, { id: null, name: 'Daily reminders (automatic)' }).then(
      (sent) => console.log(`mailbox reminders: ${sent.length} sent`),
      (e) => console.error('mailbox reminders failed:', e),
    ));
    // Automatic renewals due today, then package fees and notices, then the day's fees charged to the cards on file.
    ctx.waitUntil(autoRenewals(env).then(() => packageJobs(env)).then(() => billOverages(env)).then(
      (r) => console.log(`mailbox billing: ${r.paid} overage charges, $${r.total}`),
      (e) => console.error('mailbox billing failed:', e),
    ));
    // Tell staff (STAFF_EMAIL) which boxes' 6-month mail hold ended, so their mail goes back to the sender.
    ctx.waitUntil(holdEndNotices(env).then(
      (boxes) => console.log(`mailbox holds ended: ${boxes.length}`),
      (e) => console.error('mailbox hold notices failed:', e),
    ));
  },
};
