/// <reference types="astro/client" />

type KVNamespace = import('@cloudflare/workers-types').KVNamespace;
type D1Database = import('@cloudflare/workers-types').D1Database;

interface Env {
  ORDERS: KVNamespace;
  DB?: D1Database;
  SITE_URL: string;
  COUNTER_PIN?: string;
  PRINTER_KEY?: string;       // shared secret the counter printer agent sends to /api/print
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  // Rates and labels. Easyship is the single-call fallback; each direct carrier switches on when its keys are present.
  EASYSHIP_TOKEN?: string;
  USPS_CLIENT_ID?: string; USPS_CLIENT_SECRET?: string; USPS_CRID?: string; USPS_MID?: string; USPS_MANIFEST_MID?: string; USPS_ACCOUNT_NUMBER?: string; USPS_SANDBOX?: string;
  UPS_CLIENT_ID?: string; UPS_CLIENT_SECRET?: string; UPS_ACCOUNT_NUMBER?: string; UPS_SANDBOX?: string;
  FEDEX_CLIENT_ID?: string; FEDEX_CLIENT_SECRET?: string; FEDEX_ACCOUNT_NUMBER?: string; FEDEX_SANDBOX?: string;
  DHL_API_KEY?: string; DHL_API_SECRET?: string; DHL_ACCOUNT_NUMBER?: string; DHL_SANDBOX?: string;
}
