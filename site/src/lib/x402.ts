// x402: software pays the store per request (monetization/x402/README.md). A gated route answers
// 402 Payment Required with a price in USDC; the caller signs a transfer and retries with a payment
// header; this file asks the facilitator to verify and settle it before the route does its work.
// The store holds no wallet key: it holds a receiving address (X402_PAY_TO, the store's Kraken USDC
// deposit address). The facilitator is a URL that can change in an afternoon.
//
// Modes:
//   live  X402_PAY_TO set. Real USDC on X402_NETWORK (base by default) through X402_FACILITATOR,
//         with X402_FACILITATOR_FALLBACK tried when the first one cannot be reached.
//   mock  X402_MOCK=1 and no X402_PAY_TO. The 402s are real, any payment header that says "mock" is
//         accepted, nothing moves. For the dev server, tests and demos.
//   off   neither. Gated routes answer 503 "not switched on". Nothing is ever free by accident.
import { addX402Payment, type X402PaymentRow } from '../shipping/store';

export type X402Mode = 'live' | 'mock' | 'off';
export const x402Mode = (env: Env): X402Mode => (env.X402_PAY_TO ? 'live' : env.X402_MOCK === '1' ? 'mock' : 'off');

/** Prices in dollars. Labels are priced per call from the rate; these are the fixed ones. */
export const X402_PRICES = { rates: 0.01, track: 0.005, store: 0.001 } as const;

const USDC: Record<string, { asset: string; name: string }> = {
  base: { asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USD Coin' },
  'base-sepolia': { asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', name: 'USDC' },
};
export const DEFAULT_FACILITATOR = 'https://facilitator.payai.network';
export const FALLBACK_FACILITATOR = 'https://x402.org/facilitator';
const MOCK_PAY_TO = '0x0000000000000000000000000000000000000000';

export const toAtomic = (usd: number) => String(Math.round(usd * 1_000_000)); // USDC has six decimals

export interface PaymentRequirements {
  scheme: 'exact'; network: string; maxAmountRequired: string; resource: string; description: string; mimeType: string;
  payTo: string; maxTimeoutSeconds: number; asset: string; extra: { name: string; version: string };
}

export function requirements(env: Env, resource: string, usd: number, description: string): PaymentRequirements {
  const network = env.X402_NETWORK || 'base';
  const coin = USDC[network] ?? USDC.base;
  return { scheme: 'exact', network, maxAmountRequired: toAtomic(usd), resource, description, mimeType: 'application/json', payTo: env.X402_PAY_TO || MOCK_PAY_TO, maxTimeoutSeconds: 120, asset: coin.asset, extra: { name: coin.name, version: '2' } };
}

const b64 = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
const unb64 = (s: string) => JSON.parse(decodeURIComponent(escape(atob(s))));

/** The 402 answer: price and terms in the body and, base64, in the PAYMENT-REQUIRED header (x402 v2 clients read the header, v1 clients the body). */
export function paymentRequired(req: PaymentRequirements, error = 'Payment required', extra: Record<string, unknown> = {}): Response {
  const body = { x402Version: 1, error, accepts: [req], ...extra };
  return new Response(JSON.stringify(body), { status: 402, headers: { 'Content-Type': 'application/json', 'PAYMENT-REQUIRED': b64(body) } });
}

/** The payment header, v1 or v2 name. Null when the caller has not paid yet. */
export const readPaymentHeader = (request: Request): string | null => request.headers.get('X-PAYMENT') ?? request.headers.get('PAYMENT-SIGNATURE');

export interface Settlement { ok: true; payer: string; tx: string; network: string; facilitator: string }
export interface SettleFailure { ok: false; error: string; status: number }

/** Ask the facilitator to verify then settle. Settle before the work: postage is not refundable from the carrier. */
export async function verifyAndSettle(env: Env, header: string, req: PaymentRequirements): Promise<Settlement | SettleFailure> {
  const mode = x402Mode(env);
  if (mode === 'off') return { ok: false, error: 'Agent payments are not switched on at this store yet', status: 503 };
  if (mode === 'mock') {
    let payload: any = null; try { payload = unb64(header); } catch { /* a bare word is fine in mock mode */ }
    if (header === 'mock' || header.startsWith('mock') || payload?.mock) return { ok: true, payer: payload?.payer ?? 'mock-payer', tx: 'mock-' + crypto.randomUUID().slice(0, 8), network: req.network, facilitator: 'mock' };
    return { ok: false, error: 'Mock mode: send X-PAYMENT: mock', status: 402 };
  }
  const urls = [env.X402_FACILITATOR || DEFAULT_FACILITATOR, env.X402_FACILITATOR_FALLBACK || FALLBACK_FACILITATOR];
  let lastError = 'facilitator unreachable';
  for (const base of urls) {
    try {
      const body = JSON.stringify({ x402Version: 1, paymentHeader: header, paymentRequirements: req });
      const v = await fetch(`${base}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(10_000) });
      if (!v.ok) { lastError = `verify ${v.status}`; continue; }
      const vj: any = await v.json();
      if (!vj.isValid) return { ok: false, error: `Payment not accepted: ${vj.invalidReason ?? 'invalid'}`, status: 402 };
      const s = await fetch(`${base}/settle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(30_000) });
      if (!s.ok) { lastError = `settle ${s.status}`; continue; }
      const sj: any = await s.json();
      if (!sj.success) return { ok: false, error: `Settlement failed: ${sj.errorReason ?? sj.error ?? 'unknown'}`, status: 402 };
      return { ok: true, payer: sj.payer ?? vj.payer ?? '', tx: sj.transaction ?? '', network: sj.network ?? req.network, facilitator: base };
    } catch (e: any) { lastError = e.message; }
  }
  return { ok: false, error: `Could not reach a payment facilitator (${lastError}); try again in a minute`, status: 503 };
}

/** The PAYMENT-RESPONSE header a paid answer carries, so the caller has its receipt. */
export const settlementHeaders = (s: Settlement): Record<string, string> => {
  const v = b64({ success: true, transaction: s.tx, network: s.network, payer: s.payer });
  return { 'X-PAYMENT-RESPONSE': v, 'PAYMENT-RESPONSE': v };
};

/**
 * Gate one request. Returns the 402 (or 503) to send, or the settlement to proceed with.
 * `record` writes the payment row; the caller fills in the shipment id after the work when there is one.
 */
export async function charge(env: Env, request: Request, endpoint: string, usd: number, description: string): Promise<{ response: Response } | { settlement: Settlement; payment: X402PaymentRow }> {
  const req = requirements(env, new URL(request.url).pathname, usd, description);
  if (x402Mode(env) === 'off') return { response: new Response(JSON.stringify({ error: 'Agent payments are not switched on at this store yet', accepts: [] }), { status: 503, headers: { 'Content-Type': 'application/json' } }) };
  const header = readPaymentHeader(request);
  if (!header) return { response: paymentRequired(req) };
  const s = await verifyAndSettle(env, header, req);
  if (!s.ok) return { response: s.status === 402 ? paymentRequired(req, s.error) : new Response(JSON.stringify({ error: s.error }), { status: s.status, headers: { 'Content-Type': 'application/json' } }) };
  const payment = await addX402Payment(env, { endpoint, amount_usd: usd, payer: s.payer, network: s.network, tx_hash: s.tx, facilitator: s.facilitator, status: 'settled', shipment_id: null });
  return { settlement: s, payment };
}

/** A JSON answer carrying the payment receipt headers. */
export const paidJson = (data: unknown, s: Settlement, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...settlementHeaders(s) } });
