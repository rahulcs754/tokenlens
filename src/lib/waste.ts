import { CHEAPER_MODEL, costOf, familyOf } from "./pricing";
import type { SessionRecord } from "./types";

export type WasteTip = {
  id: "huge-context" | "failed-loops" | "expensive-model";
  title: string;
  short: string; // badge text in the sessions table
  advice: string;
  sessionIds: string[];
  estSavings: number; // USD, rough estimate
};

// Thresholds are deliberately simple so the tips are easy to explain.
export const RULES = {
  hugeContextTokens: 150_000,
  targetContextTokens: 60_000,
  errorStreak: 3,
  simplePrompts: 3,
  simpleOutputTokens: 8_000,
};

const sessionCost = (s: SessionRecord) => s.usage.reduce((n, u) => n + costOf(u.model, u), 0);
const inputSideCost = (s: SessionRecord) =>
  s.usage.reduce((n, u) => n + costOf(u.model, { ...u, output: 0 }), 0);

export function wasteTips(sessions: SessionRecord[]): WasteTip[] {
  // Rule 1: one request carried a very large context. Most of that is re-read every turn.
  const huge = sessions.filter((s) => s.maxContext >= RULES.hugeContextTokens);
  const hugeSave = huge.reduce(
    (n, s) => n + inputSideCost(s) * Math.max(0, 1 - RULES.targetContextTokens / s.maxContext),
    0,
  );

  // Rule 2: the agent kept retrying a failing tool call (tests, builds, edits).
  const loops = sessions.filter((s) => s.maxErrorStreak >= RULES.errorStreak);
  const loopSave = loops.reduce((n, s) => n + sessionCost(s) * Math.min(1, s.toolErrors / Math.max(1, s.turns)), 0);

  // Rule 3: a top-tier model for a short, simple task.
  const pricey = sessions.filter((s) => {
    const fams = new Set(s.usage.map((u) => familyOf(u.model)));
    const out = s.usage.reduce((n, u) => n + u.output, 0);
    return (
      (fams.has("Opus") || fams.has("Fable")) &&
      s.prompts <= RULES.simplePrompts &&
      out <= RULES.simpleOutputTokens
    );
  });
  const priceySave = pricey.reduce(
    (n, s) =>
      n +
      s.usage.reduce((m, u) => {
        const f = familyOf(u.model);
        return f === "Opus" || f === "Fable" ? m + costOf(u.model, u) - costOf(CHEAPER_MODEL, u) : m;
      }, 0),
    0,
  );

  return [
    {
      id: "huge-context" as const,
      title: "Huge context",
      short: "big context",
      advice: `${huge.length} sessions sent over ${RULES.hugeContextTokens / 1000}k tokens in one request. Use /clear between tasks, /compact on long ones, and keep CLAUDE.md short.`,
      sessionIds: huge.map((s) => s.sessionId),
      estSavings: hugeSave,
    },
    {
      id: "failed-loops" as const,
      title: "Repeated failed loops",
      short: "retry loop",
      advice: `${loops.length} sessions had ${RULES.errorStreak}+ failed tool calls in a row. Stop and give the error plus a hint, instead of letting it retry.`,
      sessionIds: loops.map((s) => s.sessionId),
      estSavings: loopSave,
    },
    {
      id: "expensive-model" as const,
      title: "Expensive model, simple task",
      short: "pricey model",
      advice: `${pricey.length} short sessions (≤${RULES.simplePrompts} prompts) ran on Opus or Fable. Switch to Sonnet with /model for quick fixes and questions.`,
      sessionIds: pricey.map((s) => s.sessionId),
      estSavings: priceySave,
    },
  ].sort((a, b) => b.estSavings - a.estSavings);
}
