import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDashboard } from "../src/lib/aggregate.ts";
import { demoSessions } from "../src/lib/demo.ts";

const today = new Date("2026-10-28T12:00:00Z");
const all = demoSessions(60, today);

test("totals match the sum of days, repos and sessions", () => {
  const d = buildDashboard(all, { from: "2026-09-29", to: "2026-10-28", repo: null, model: null });
  const sum = (xs) => xs.reduce((n, x) => n + x, 0);
  assert.equal(d.byDay.length, 30);
  assert.ok(Math.abs(sum(d.byDay.map((x) => x.total)) - d.totals.cost) < 1e-6);
  assert.ok(Math.abs(sum(d.byRepo.map((x) => x.cost)) - d.totals.cost) < 1e-6);
  assert.ok(Math.abs(sum(d.sessions.map((x) => x.cost)) - d.totals.cost) < 1e-6);
  assert.equal(d.tips.length, 3);
  assert.ok(d.tips.every((t) => t.estSavings >= 0));
});

test("repo and model filters narrow the data", () => {
  const d = buildDashboard(all, { from: "2026-08-30", to: "2026-10-28", repo: "acme/api", model: "claude-opus-5-5" });
  assert.ok(d.sessions.every((s) => s.repo === "acme/api"));
  assert.ok(d.byModel.every((m) => m.name === "claude-opus-5-5"));
  assert.ok(d.repos.length > 1, "dropdown keeps all repos");
});
