// USD per 1M tokens. cacheWrite = 5-minute cache write (1-hour writes cost 2x input), cacheRead = cache hit.
// Source: Anthropic API list prices (Oct 2026). Update here when prices change.
export type Price = { input: number; output: number; cacheWrite: number; cacheRead: number };

const p = (input: number, output: number, cacheRead = input * 0.1): Price => ({
  input,
  output,
  cacheWrite: input * 1.25,
  cacheRead,
});

// Ordered: first prefix match wins, so put specific ids before broad ones.
const TABLE: [string, Price][] = [
  ["claude-fable-5-1", p(10, 50, 0.25)],
  ["claude-fable-5", p(10, 50)],
  ["claude-mythos", p(10, 50)],
  ["claude-opus-5-5", p(4, 20, 0.2)],
  ["claude-opus-5", p(5, 25)],
  ["claude-opus-4-8", p(5, 25)],
  ["claude-opus-4-7", p(5, 25)],
  ["claude-opus-4-6", p(5, 25)],
  ["claude-opus-4-5", p(5, 25)],
  ["claude-opus-4", p(15, 75)],
  ["claude-sonnet-5", p(2, 10, 0.2)],
  ["claude-sonnet-4", p(3, 15)],
  ["claude-3-7-sonnet", p(3, 15)],
  ["claude-3-5-sonnet", p(3, 15)],
  ["claude-haiku-5-5", p(0.1, 0.5)],
  ["claude-haiku-4-5", p(1, 5)],
  ["claude-3-5-haiku", p(0.8, 4)],
  ["claude-3-haiku", p(0.25, 1.25)],
];

// Unknown model: price it like Sonnet so totals are never silently zero.
const FALLBACK = p(3, 15);

export function priceFor(model: string): Price {
  const m = model.toLowerCase();
  for (const [prefix, price] of TABLE) if (m.startsWith(prefix)) return price;
  if (m.includes("opus")) return p(5, 25);
  if (m.includes("haiku")) return p(1, 5);
  return FALLBACK;
}

export type Tokens = { input: number; output: number; cacheWrite: number; cacheWrite1h?: number; cacheRead: number };

export function costOf(model: string, t: Tokens): number {
  const pr = priceFor(model);
  return (
    (t.input * pr.input +
      t.output * pr.output +
      t.cacheWrite * pr.cacheWrite +
      (t.cacheWrite1h ?? 0) * pr.input * 2 +
      t.cacheRead * pr.cacheRead) /
    1_000_000
  );
}

export type Family = "Opus" | "Sonnet" | "Haiku" | "Fable" | "Other";
export const FAMILIES: Family[] = ["Opus", "Sonnet", "Haiku", "Fable", "Other"];

export function familyOf(model: string): Family {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku")) return "Haiku";
  if (m.includes("fable") || m.includes("mythos")) return "Fable";
  return "Other";
}

// The cheaper model a simple task could have used instead (rule 3 of the waste tips).
export const CHEAPER_MODEL = "claude-sonnet-5-5";
