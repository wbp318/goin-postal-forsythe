/// <reference types="astro/client" />

type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

// The adapter exposes the bindings through this module at runtime; the types package does not declare it.
declare module 'cloudflare:workers' {
  export const env: Env;
}
type D1Database = import('@cloudflare/workers-types').D1Database;

interface Env {
  ORDERS: KVNamespace;
  DB?: D1Database;
  SITE_URL: string;
  STORE_ID?: string;          // short slug of this deployment's store: forsythe, west-carroll
  STORE_JSON?: string;        // this store's facts (site/stores/<slug>.json) for a second store; blank keeps the Forsythe defaults
  COUNTER_PIN?: string;
  OWNER_PIN?: string;         // optional second PIN that alone may save price rules; blank means COUNTER_PIN may
  PRINTER_KEY?: string;       // shared secret the counter printer agent sends to /api/print
  RECEIPT_FORMAT?: string;    // "escpos" when the shop has a till-roll receipt printer; blank prints receipts as 4x6 ZPL on the Zebra
  // Customer updates. Blank means log instead of send.
  RESEND_API_KEY?: string; MAIL_FROM?: string; STAFF_EMAIL?: string;
  TWILIO_ACCOUNT_SID?: string; TWILIO_AUTH_TOKEN?: string; TWILIO_FROM?: string;
  STRIPE_SECRET_KEY?: string;
  // x402, software paying per request (monetization/x402). Live when X402_PAY_TO is set; mock when X402_MOCK=1; off otherwise.
  X402_PAY_TO?: string;       // the store's USDC receiving address (Kraken deposit address on X402_NETWORK)
  X402_NETWORK?: string;      // base (default) or base-sepolia for testing
  X402_FACILITATOR?: string;  // verify/settle service; default PayAI's hosted one
  X402_FACILITATOR_FALLBACK?: string; // tried when the first cannot be reached; default x402.org (Coinbase)
  X402_MOCK?: string;         // "1" accepts X-PAYMENT: mock on the dev server; never set it in production
  STRIPE_WEBHOOK_SECRET?: string;
  // Rates and labels. Easyship is the single-call fallback; each direct carrier switches on when its keys are present.
  EASYSHIP_TOKEN?: string;
  USPS_CLIENT_ID?: string; USPS_CLIENT_SECRET?: string; USPS_CRID?: string; USPS_MID?: string; USPS_MANIFEST_MID?: string; USPS_ACCOUNT_NUMBER?: string; USPS_SANDBOX?: string;
  UPS_CLIENT_ID?: string; UPS_CLIENT_SECRET?: string; UPS_ACCOUNT_NUMBER?: string; UPS_SANDBOX?: string;
  FEDEX_CLIENT_ID?: string; FEDEX_CLIENT_SECRET?: string; FEDEX_ACCOUNT_NUMBER?: string; FEDEX_SANDBOX?: string;
  DHL_API_KEY?: string; DHL_API_SECRET?: string; DHL_ACCOUNT_NUMBER?: string; DHL_SANDBOX?: string;
}
