import type { SessionRecord, UsageRow } from "./types";

// Deterministic sample data so the demo looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const REPOS = ["acme/web-app", "acme/api", "acme/design-system", "personal/blog", "acme/mobile"];
const MODELS: [string, number][] = [
  ["claude-sonnet-5-5", 0.55],
  ["claude-opus-5-5", 0.3],
  ["claude-haiku-5-5", 0.1],
  ["claude-fable-5-1", 0.05],
];

function pick<T>(r: () => number, items: [T, number][]): T {
  let x = r();
  for (const [v, w] of items) {
    if ((x -= w) <= 0) return v;
  }
  return items[0][0];
}

export function demoSessions(days = 60, today = new Date()): SessionRecord[] {
  const r = rng(42);
  const out: SessionRecord[] = [];
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(end - d * 86_400_000);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const count = Math.floor(r() * (weekend ? 2 : 5)) + (weekend ? 0 : 1);
    for (let i = 0; i < count; i++) {
      const repo = REPOS[Math.floor(r() * r() * REPOS.length)];
      const model = pick(r, MODELS);
      const prompts = 1 + Math.floor(r() * 14);
      const turns = prompts * (2 + Math.floor(r() * 6));
      const bigContext = r() < 0.12;
      const loop = r() < 0.1;
      const avgCtx = bigContext ? 120_000 + r() * 80_000 : 25_000 + r() * 45_000;
      const cacheRead = Math.round(turns * avgCtx * 0.85);
      const cacheWrite = Math.round(turns * avgCtx * 0.1);
      const input = Math.round(turns * 600);
      const output = Math.round(turns * (300 + r() * 900));
      const start = new Date(date.getTime() + (8 + r() * 10) * 3_600_000);
      const usage: UsageRow[] = [
        { day: date.toISOString().slice(0, 10), model, input, output, cacheWrite, cacheRead, messages: turns },
      ];
      // Many sessions also call Haiku for small background work.
      if (model !== "claude-haiku-5-5" && r() < 0.5) {
        usage.push({
          day: usage[0].day,
          model: "claude-haiku-5-5",
          input: turns * 200,
          output: turns * 80,
          cacheWrite: 0,
          cacheRead: turns * 1_000,
          messages: Math.ceil(turns / 3),
        });
      }
      const toolErrors = loop ? 4 + Math.floor(r() * 6) : Math.floor(r() * 2);
      out.push({
        sessionId: `demo-${date.toISOString().slice(0, 10)}-${i}`,
        repo,
        branch: r() < 0.6 ? "main" : "feature/" + ["auth", "charts", "billing", "search"][Math.floor(r() * 4)],
        startedAt: start.toISOString(),
        endedAt: new Date(start.getTime() + turns * 40_000).toISOString(),
        prompts,
        turns,
        toolErrors,
        maxErrorStreak: loop ? Math.min(toolErrors, 3 + Math.floor(r() * 3)) : toolErrors,
        maxContext: Math.round(avgCtx * (1.2 + r() * 0.4)),
        usage,
      });
    }
  }
  return out;
}
