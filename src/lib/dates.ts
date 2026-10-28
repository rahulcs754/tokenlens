import type { Filters } from "./types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Default range is the last 30 days. Bad or reversed dates fall back to defaults.
export function parseFilters(sp: SP): Filters {
  let from = one(sp.from) ?? "";
  let to = one(sp.to) ?? "";
  if (!ISO.test(to)) to = todayUTC();
  if (!ISO.test(from)) from = daysAgo(29);
  if (from > to) [from, to] = [to, from];
  return { from, to, repo: one(sp.repo) || null, model: one(sp.model) || null };
}
