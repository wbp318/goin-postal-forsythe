#!/usr/bin/env node
// PeterShip printer agent. Runs on the counter PC. Every few seconds it asks the website for the next
// print job and sends it to the label printer, then tells the website it printed. No inbound ports,
// no printer drivers in the browser: a staff tap on the tablet prints at the counter.
//
//   node agent.mjs            reads printer-agent.json next to this file (see README.md)
//   node agent.mjs --once     one job then exit, for testing
//   node agent.mjs --test     prints a ZPL test label and exits, no website involved
//   node agent.mjs --test-receipt   prints an ESC/POS test slip on the receipt printer and exits
//
// Jobs come in four kinds:
//   label_zpl       base64 ZPL        -> raw TCP to a networked Zebra (port 9100) or to a shared Windows printer
//   label_pdf       a URL to a PDF    -> downloaded to the spool folder and printed with the default PDF app
//   receipt         base64 ZPL        -> 4x6 drop-off receipts and Z-reports for the Zebra (or a second Zebra under "receipt")
//   receipt_escpos  base64 ESC/POS    -> a till-roll receipt printer under "receipt"; the site sends these only when
//                                        RECEIPT_FORMAT=escpos is set on the website
// A job that fails five times is reported to the website as failed and left out of the queue; staff see it on the
// queue page with a Retry button, which puts it back. Every poll also sends a heartbeat, so the queue page can say
// "printer agent online, last job 2 min ago" or "offline".
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const cfgPath = join(here, 'printer-agent.json');
const cfg = Object.assign(
  { site: 'http://localhost:4321', key: '', printer: 'counter', poll_seconds: 3, zebra: { host: '', port: 9100, share: '' }, pdf: { spool: join(here, 'spool'), app: '' }, receipt: { host: '', port: 9100, share: '' }, max_tries: 5 },
  existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {},
);
if (process.env.PETERSHIP_SITE) cfg.site = process.env.PETERSHIP_SITE;
if (process.env.PRINTER_KEY) cfg.key = process.env.PRINTER_KEY;

const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VERSION = '1.36.0';

/** Send raw bytes to a printer: a network printer on port 9100, or a Windows shared printer by name. */
function raw(bytes, target) {
  if (target.host) {
    return new Promise((resolve, reject) => {
      const sock = createConnection({ host: target.host, port: target.port || 9100 }, () => sock.end(bytes));
      sock.setTimeout(10_000, () => { sock.destroy(); reject(new Error(`printer ${target.host} timed out`)); });
      sock.on('error', reject);
      sock.on('close', (hadError) => (hadError ? undefined : resolve()));
    });
  }
  if (target.share) {
    // Windows: copy the raw file to a shared printer, e.g. \\COUNTER-PC\Zebra. Share the printer once in Settings.
    mkdirSync(cfg.pdf.spool, { recursive: true });
    const tmp = join(cfg.pdf.spool, `raw-${Date.now()}.prn`);
    writeFileSync(tmp, bytes);
    return run('cmd', ['/c', 'copy', '/b', tmp, target.share]);
  }
  throw new Error('no printer configured: set zebra.host (network) or zebra.share (Windows shared printer)');
}

function run(cmd, cmdArgs) {
  return new Promise((resolve, reject) => execFile(cmd, cmdArgs, { windowsHide: true }, (err, out, errOut) => (err ? reject(new Error(errOut || err.message)) : resolve(out))));
}

/** PDF labels: save, then hand to the OS. Windows prints with the default PDF app; macOS and Linux use lp. */
async function printPdf(url, id) {
  mkdirSync(cfg.pdf.spool, { recursive: true });
  const file = join(cfg.pdf.spool, `label-${id}.pdf`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  if (cfg.pdf.app) return run(cfg.pdf.app, [file]);
  if (process.platform === 'win32') return run('powershell', ['-NoProfile', '-Command', `Start-Process -FilePath '${file.replace(/'/g, "''")}' -Verb Print -WindowStyle Hidden`]);
  return run('lp', [file]);
}

const receiptTarget = () => (cfg.receipt.host || cfg.receipt.share ? cfg.receipt : cfg.zebra);

async function printJob(job) {
  if (job.kind === 'label_zpl') return raw(Buffer.from(job.payload, 'base64'), cfg.zebra);
  if (job.kind === 'receipt') return raw(Buffer.from(job.payload, 'base64'), receiptTarget());
  if (job.kind === 'receipt_escpos') {
    if (!cfg.receipt.host && !cfg.receipt.share) throw new Error('an ESC/POS receipt arrived but no receipt printer is configured (receipt.host or receipt.share)');
    return raw(Buffer.from(job.payload, 'base64'), cfg.receipt);
  }
  if (job.kind === 'label_pdf') return printPdf(job.payload, job.id);
  throw new Error(`unknown job kind ${job.kind}`);
}

const headers = { 'X-Printer-Key': cfg.key, 'Content-Type': 'application/json' };
async function next() {
  const res = await fetch(`${cfg.site}/api/print?printer=${encodeURIComponent(cfg.printer)}`, { headers });
  if (res.status === 403) throw new Error('the website rejected the printer key; check PRINTER_KEY on both sides');
  if (!res.ok) throw new Error(`site answered ${res.status}`);
  return (await res.json()).job;
}
async function post(body) {
  const res = await fetch(`${cfg.site}/api/print`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`site answered ${res.status} to ${body.action}`);
  return res.json();
}

const TEST_ZPL = '^XA^CF0,40^FO40,40^FDPeterShip test label^FS^CF0,28^FO40,100^FDGoin Postal Forsythe^FS^FO40,140^FD' + new Date().toLocaleString() + '^FS^BY3^FO40,200^BCN,100,Y,N,N^FDGP-TEST01^FS^XZ';
const ESC = '\x1b', GS = '\x1d';
const TEST_ESCPOS = Buffer.from(`${ESC}@${ESC}a\x01${ESC}E\x01PeterShip test slip\n${ESC}E\x00Goin Postal Forsythe\n${new Date().toLocaleString()}\n\n${GS}k\x49\x09GP-TEST01\n\n\n${GS}V\x41\x03`, 'latin1');

if (args.has('--test')) {
  await raw(Buffer.from(TEST_ZPL), cfg.zebra);
  log('test label sent');
  process.exit(0);
}
if (args.has('--test-receipt')) {
  await raw(TEST_ESCPOS, cfg.receipt);
  log('test slip sent to the receipt printer');
  process.exit(0);
}
if (!cfg.key) { console.error('No printer key. Put it in printer-agent.json or the PRINTER_KEY environment variable.'); process.exit(1); }

log(`agent ${VERSION} watching ${cfg.site} for printer "${cfg.printer}" every ${cfg.poll_seconds}s`);

// Side job: while the shop PC is on, ask the site to refresh tracking for open shipments every few
// minutes (POST /api/track-poll). The scheduled GitHub Action covers the hours the PC is off.
const trackEvery = (cfg.track_poll_minutes ?? 10) * 60_000;
let lastTrackPoll = 0;
async function trackPoll() {
  if (!trackEvery || Date.now() - lastTrackPoll < trackEvery) return;
  lastTrackPoll = Date.now();
  try {
    const res = await fetch(`${cfg.site}/api/track-poll`, { method: 'POST', headers, body: JSON.stringify({ limit: 50 }) });
    const r2 = await res.json();
    if (!res.ok) throw new Error(r2.error);
    if (r2.checked) log(`tracking: checked ${r2.checked}, ${r2.updated} updated${r2.errors.length ? `, ${r2.errors.length} errors` : ''}`);
  } catch (e) {
    log(`tracking poll failed: ${e.message}`);
  }
}

// Heartbeat: what the queue page shows under "printer". Sent every poll; the site keeps it for two minutes.
const state = { last_job_at: null, last_error: null, printed: 0, failed: 0 };
let lastBeat = 0;
async function heartbeat() {
  if (Date.now() - lastBeat < 20_000) return;
  lastBeat = Date.now();
  try { await post({ action: 'heartbeat', printer: cfg.printer, version: VERSION, zebra: cfg.zebra.host || cfg.zebra.share || null, receipt: cfg.receipt.host || cfg.receipt.share || null, ...state }); }
  catch (e) { log(`heartbeat failed: ${e.message}`); }
}

const failed = new Map(); // job id -> attempts, so a bad job does not block the queue forever
for (;;) {
  await heartbeat();
  await trackPoll();
  try {
    const job = await next();
    if (job) {
      const tries = (failed.get(job.id) ?? 0) + 1;
      try {
        await printJob(job);
        await post({ action: 'done', id: job.id });
        failed.delete(job.id);
        state.last_job_at = new Date().toISOString(); state.last_error = null; state.printed++;
        log(`printed job ${job.id} (${job.kind}) for ${job.shipment_id ?? 'no shipment'}`);
      } catch (e) {
        failed.set(job.id, tries);
        state.last_error = `${job.kind} ${job.id}: ${e.message}`;
        log(`job ${job.id} failed (${tries}): ${e.message}`);
        if (tries >= cfg.max_tries) {
          failed.delete(job.id); state.failed++;
          await post({ action: 'failed', id: job.id, error: e.message, tries }).catch((err) => log(`could not report the failure: ${err.message}`));
          log(`job ${job.id} set aside after ${tries} tries; staff can press Retry on the queue page`);
        }
      }
      if (args.has('--once')) break;
      continue; // more may be waiting
    }
  } catch (e) {
    state.last_error = e.message;
    log(e.message);
  }
  if (args.has('--once')) break;
  await sleep(cfg.poll_seconds * 1000);
}
