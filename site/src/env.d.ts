/// <reference types="astro/client" />

type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

interface Env {
  ORDERS: KVNamespace;
  SITE_URL: string;
  EASYSHIP_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  COUNTER_PIN?: string;
}
