import { costOf, familyOf, FAMILIES, type Family } from "./pricing";
import type { Filters, SessionRecord, UsageRow } from "./types";
import { wasteTips, type WasteTip } from "./waste";

export type DayPoint = { day: string; total: number } & Record<Family, number>;
export type NamedCost = { name: string; cost: number; tokens: number };
export type SessionRow = {
  sessionId: string;
  repo: string;
  startedAt: string;
  mainModel: string;
  prompts: number;
  tokens: number;
  cost: number;
  flags: string[];
};

export type Dashboard = {
  filters: Filters;
  repos: string[];
  models: string[];
  totals: { cost: number; tokens: number; sessions: number; costPerSession: number; cacheHitRate: number };
  byDay: DayPoint[];
  byRepo: NamedCost[];
  byModel: NamedCost[];
  sessions: SessionRow[];
  tips: WasteTip[];
};

const tokensOf = (u: UsageRow) => u.input + u.output + u.cacheWrite + (u.cacheWrite1h ?? 0) + u.cacheRead;

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Pure function: all dashboard numbers come from here, for demo data and DB data alike.
export function buildDashboard(all: SessionRecord[], filters: Filters): Dashboard {
  const repos = [...new Set(all.map((s) => s.repo))].sort();
  const models = [...new Set(all.flatMap((s) => s.usage.map((u) => u.model)))].sort();

  // Keep only usage inside the range and matching the filters.
  const sessions: SessionRecord[] = [];
  for (const s of all) {
    if (filters.repo && s.repo !== filters.repo) continue;
    const usage = s.usage.filter(
      (u) => u.day >= filters.from && u.day <= filters.to && (!filters.model || u.model === filters.model),
    );
    if (usage.length) sessions.push({ ...s, usage });
  }

  const days = new Map<string, DayPoint>();
  for (const day of eachDay(filters.from, filters.to)) {
    days.set(day, { day, total: 0, Opus: 0, Sonnet: 0, Haiku: 0, Fable: 0, Other: 0 });
  }
  const repoMap = new Map<string, NamedCost>();
  const modelMap = new Map<string, NamedCost>();
  let cost = 0;
  let tokens = 0;
  let cacheRead = 0;
  let inputSide = 0;
  const rows: SessionRow[] = [];

  for (const s of sessions) {
    let sCost = 0;
    let sTokens = 0;
    const perModel = new Map<string, number>();
    for (const u of s.usage) {
      const c = costOf(u.model, u);
      const t = tokensOf(u);
      sCost += c;
      sTokens += t;
      cacheRead += u.cacheRead;
      inputSide += u.input + u.cacheRead + u.cacheWrite + (u.cacheWrite1h ?? 0);
      perModel.set(u.model, (perModel.get(u.model) ?? 0) + c);
      const dp = days.get(u.day);
      if (dp) {
        dp[familyOf(u.model)] += c;
        dp.total += c;
      }
      const m = modelMap.get(u.model) ?? { name: u.model, cost: 0, tokens: 0 };
      m.cost += c;
      m.tokens += t;
      modelMap.set(u.model, m);
    }
    const r = repoMap.get(s.repo) ?? { name: s.repo, cost: 0, tokens: 0 };
    r.cost += sCost;
    r.tokens += sTokens;
    repoMap.set(s.repo, r);
    cost += sCost;
    tokens += sTokens;
    const mainModel = [...perModel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    rows.push({
      sessionId: s.sessionId,
      repo: s.repo,
      startedAt: s.startedAt,
      mainModel,
      prompts: s.prompts,
      tokens: sTokens,
      cost: sCost,
      flags: [],
    });
  }

  const tips = wasteTips(sessions);
  const flagged = new Map<string, string[]>();
  for (const tip of tips) for (const id of tip.sessionIds) flagged.set(id, [...(flagged.get(id) ?? []), tip.short]);
  for (const r of rows) r.flags = flagged.get(r.sessionId) ?? [];

  const byCost = (a: NamedCost, b: NamedCost) => b.cost - a.cost;
  return {
    filters,
    repos,
    models,
    totals: {
      cost,
      tokens,
      sessions: sessions.length,
      costPerSession: sessions.length ? cost / sessions.length : 0,
      cacheHitRate: inputSide ? cacheRead / inputSide : 0,
    },
    byDay: [...days.values()],
    byRepo: [...repoMap.values()].sort(byCost),
    byModel: [...modelMap.values()].sort(byCost),
    sessions: rows.sort((a, b) => b.cost - a.cost),
    tips,
  };
}

export { FAMILIES };
