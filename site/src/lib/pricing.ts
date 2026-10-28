// Retail pricing on top of carrier cost, so the online price matches the counter.
// GP Rate Pro is the store's in-shop quoting system. The same rules it applies live in the
// retail_rules table, edited by the owners at /counter/rules. Until the first save there,
// src/data/ratepro.json is used instead, so a fresh install still prices.
// Customers never see where the cost came from; they see one retail price per service.
import fileRules from '../data/ratepro.json';
import type { Rate } from '../shipping/types';
import { loadRules, type RuleRow, type RulesConfig } from '../shipping/store';

interface Rule { percent?: number | null; flat?: number | null; price?: number | null }
interface FileRules { enabled: boolean; round_to_99: boolean; default: Rule; carriers: Record<string, Rule>; services: Record<string, Rule> }

/** The JSON file in the same shape as the table, for the fallback and for "load from file" in the editor. */
export function rulesFromFile(): RulesConfig {
  const f = fileRules as FileRules;
  const row = (scope: RuleRow['scope'], match: string | null, r: Rule): RuleRow => ({ scope, match, percent: r.percent ?? null, flat: r.flat ?? null, price: r.price ?? null, active: 1 });
  return {
    enabled: f.enabled, round_to_99: f.round_to_99, updated_at: null,
    rules: [row('default', null, f.default), ...Object.entries(f.carriers).map(([m, r]) => row('carrier', m, r)), ...Object.entries(f.services).map(([m, r]) => row('service', m, r))],
  };
}

/** The rules in force: the table if anything was ever saved, else the file. */
export async function effectiveRules(env: Env): Promise<RulesConfig & { source: 'table' | 'file' }> {
  const saved = await loadRules(env);
  return saved ? { ...saved, source: 'table' } : { ...rulesFromFile(), source: 'file' };
}

function ruleFor(c: RulesConfig, rate: Rate): Rule {
  const active = c.rules.filter((r) => r.active);
  const byService = active.find((r) => r.scope === 'service' && (r.match ?? '').toLowerCase() === rate.service.toLowerCase());
  if (byService) return byService;
  const byCarrier = active.find((r) => r.scope === 'carrier' && rate.carrier.toLowerCase().startsWith((r.match ?? '').toLowerCase()));
  if (byCarrier) return byCarrier;
  return active.find((r) => r.scope === 'default') ?? {};
}

function round(c: RulesConfig, n: number) {
  if (c.round_to_99) return Math.max(0.99, Math.floor(n) + 0.99);
  return Math.round(n * 100) / 100;
}

/** Apply one set of rules to rates whose cost is known. Pure, so the editor can preview a draft. */
export function applyRules(c: RulesConfig, rates: Rate[]): Rate[] {
  if (!c.enabled) return rates.map((r) => ({ ...r, total_charge: r.cost }));
  return rates.map((r) => {
    const rule = ruleFor(c, r);
    const price = rule.price != null ? rule.price : r.cost * (1 + (rule.percent ?? 0) / 100) + (rule.flat ?? 0);
    return { ...r, total_charge: round(c, price) };
  });
}

/** Turns carrier cost into the store's retail price with the rules in force. With enabled off, cost passes through. */
export async function retail(env: Env, rates: Rate[]): Promise<Rate[]> {
  return applyRules(await effectiveRules(env), rates);
}
