// Retail pricing on top of carrier cost, so the online price matches the counter.
// GP Rate Pro is the store's in-shop quoting system. Until it gives us an export or an API,
// src/data/ratepro.json holds the same retail rules copied from its screens.
// Customers never see where the cost came from; they see one retail price per service.
import rules from '../data/ratepro.json';
import type { Rate } from '../shipping/types';

interface Rule { percent?: number; flat?: number; price?: number }
interface Rules {
  enabled: boolean;
  round_to_99: boolean;
  default: Rule;
  carriers: Record<string, Rule>;   // "USPS", "UPS", "FedEx", "DHL"
  services: Record<string, Rule>;   // exact service name, wins over carrier
}

const R = rules as Rules;

function ruleFor(rate: Rate): Rule {
  const byService = Object.entries(R.services).find(([name]) => name.toLowerCase() === rate.service.toLowerCase())?.[1];
  if (byService) return byService;
  const byCarrier = Object.entries(R.carriers).find(([name]) => rate.carrier.toLowerCase().startsWith(name.toLowerCase()))?.[1];
  return byCarrier ?? R.default;
}

function round(n: number) {
  if (R.round_to_99) return Math.max(0.99, Math.floor(n) + 0.99);
  return Math.round(n * 100) / 100;
}

/** Turns carrier cost into the store's retail price. With `enabled: false` the cost passes through unchanged. */
export function retail(rates: Rate[]): Rate[] {
  if (!R.enabled) return rates.map((r) => ({ ...r, total_charge: r.cost }));
  return rates.map((r) => {
    const rule = ruleFor(r);
    const price = rule.price != null ? rule.price : r.cost * (1 + (rule.percent ?? 0) / 100) + (rule.flat ?? 0);
    return { ...r, total_charge: round(price) };
  });
}
