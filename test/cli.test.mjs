import assert from "node:assert/strict";
import { test } from "node:test";
import { costOf as cliCost, parseLines } from "../cli/tokenlens.mjs";
import { costOf as appCost } from "../src/lib/pricing.ts";

const t = { input: 1000, output: 2000, cacheWrite: 3000, cacheWrite1h: 500, cacheRead: 40000 };

test("CLI and app price every model the same", () => {
  for (const m of [
    "claude-opus-5-5", "claude-opus-5", "claude-opus-4-8", "claude-opus-4-1-20250805", "claude-sonnet-5-5",
    "claude-sonnet-4-6", "claude-haiku-5-5", "claude-haiku-4-5-20251001", "claude-fable-5-1", "claude-3-5-haiku-20241022", "some-new-model",
  ]) {
    assert.ok(Math.abs(cliCost(m, t) - appCost(m, t)) < 1e-12, m);
  }
});

const line = (o) => JSON.stringify({ sessionId: "s1", cwd: "/tmp/x/my-repo", timestamp: "2026-10-01T10:00:00Z", ...o });
const asst = (id, usage, extra = {}) =>
  line({ type: "assistant", message: { id, model: "claude-opus-5-5", usage }, ...extra });
const result = (isError) => line({ type: "user", message: { content: [{ type: "tool_result", is_error: isError }] } });

test("parses sessions, dedupes split messages, counts error streaks", () => {
  const lines = [
    line({ type: "user", message: { content: "fix the bug" } }),
    line({ type: "user", isMeta: true, message: { content: "meta" } }),
    asst("m1", { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 50 }),
    asst("m1", { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 100, cache_creation_input_tokens: 50 }),
    result(true), result(true), result(true), result(false), result(true),
    asst("m2", { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 200_000, cache_creation_input_tokens: 0 }, { timestamp: "2026-10-02T09:00:00Z" }),
    "not json",
  ];
  const [s] = parseLines(lines);
  assert.equal(s.repo, "my-repo");
  assert.equal(s.prompts, 1);
  assert.equal(s.turns, 2);
  assert.equal(s.toolErrors, 4);
  assert.equal(s.maxErrorStreak, 3);
  assert.equal(s.maxContext, 200_001);
  assert.equal(s.endedAt, "2026-10-02T09:00:00Z");
  assert.deepEqual(s.usage.map((u) => [u.day, u.output, u.cacheWrite]), [["2026-10-01", 20, 50], ["2026-10-02", 1, 0]]);
});

test("since filter drops old usage", () => {
  const sessions = parseLines([asst("m1", { input_tokens: 1, output_tokens: 1 })], "2026-10-05");
  assert.equal(sessions.length, 0);
});
