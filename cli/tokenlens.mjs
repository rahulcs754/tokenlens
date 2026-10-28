#!/usr/bin/env node
// TokenLens CLI: reads Claude Code logs (~/.claude/projects) and shows or uploads token usage.
// Zero dependencies. Needs Node 18+.
//
//   node tokenlens.mjs scan   [--since 30d] [--dir PATH] [--json]
//   node tokenlens.mjs upload --key KEY [--url https://...] [--since 90d] [--dir PATH]
//
// Only token counts, model names, repo names, branch names and timestamps are read out.
// Prompts, code and file paths never leave your machine.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

const DEFAULT_URL = "https://tokenlens.vercel.app";
const BATCH = 300;

// Keep in sync with src/lib/pricing.ts (test/cli.test.mjs checks this).
const PRICES = [
  ["claude-fable-5-1", 10, 50, 0.25],
  ["claude-fable-5", 10, 50],
  ["claude-mythos", 10, 50],
  ["claude-opus-5-5", 4, 20, 0.2],
  ["claude-opus-5", 5, 25],
  ["claude-opus-4-8", 5, 25],
  ["claude-opus-4-7", 5, 25],
  ["claude-opus-4-6", 5, 25],
  ["claude-opus-4-5", 5, 25],
  ["claude-opus-4", 15, 75],
  ["claude-sonnet-5", 2, 10, 0.2],
  ["claude-sonnet-4", 3, 15],
  ["claude-3-7-sonnet", 3, 15],
  ["claude-3-5-sonnet", 3, 15],
  ["claude-haiku-5-5", 0.1, 0.5],
  ["claude-haiku-4-5", 1, 5],
  ["claude-3-5-haiku", 0.8, 4],
  ["claude-3-haiku", 0.25, 1.25],
];

export function costOf(model, t) {
  const m = model.toLowerCase();
  let row = PRICES.find(([p]) => m.startsWith(p));
  if (!row) row = m.includes("opus") ? ["", 5, 25] : m.includes("haiku") ? ["", 1, 5] : ["", 3, 15];
  const [, input, output, read = input * 0.1] = row;
  return (
    (t.input * input +
      t.output * output +
      t.cacheWrite * input * 1.25 +
      (t.cacheWrite1h ?? 0) * input * 2 +
      t.cacheRead * read) /
    1e6
  );
}

// ---------- reading logs ----------

function* jsonlFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jsonlFiles(p);
    else if (e.name.endsWith(".jsonl")) yield p;
  }
}

// Repo name from the git remote (owner/repo), else the folder name. Cached per cwd.
const repoCache = new Map();
export function repoName(cwd) {
  if (!cwd) return "unknown";
  if (repoCache.has(cwd)) return repoCache.get(cwd);
  let name = basename(cwd) || "unknown";
  let dir = cwd;
  for (let i = 0; i < 6 && dir; i++) {
    const cfg = join(dir, ".git", "config");
    if (existsSync(cfg)) {
      const url = /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(readFileSync(cfg, "utf8"))?.[1];
      const m = url && /[:/]([^/:]+\/[^/]+?)(\.git)?$/.exec(url);
      name = m ? m[1] : basename(dir);
      break;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  repoCache.set(cwd, name);
  return name;
}

const isPrompt = (o) => {
  if (o.type !== "user" || o.isMeta || o.isSidechain) return false;
  const c = o.message?.content;
  if (typeof c === "string") return !c.startsWith("<command-") && !c.startsWith("<local-command");
  return Array.isArray(c) && c.some((b) => b?.type === "text") && !c.some((b) => b?.type === "tool_result");
};

// Parse JSONL lines (from one or more files) into per-session records.
export function parseLines(lines, sinceDay = "0000-00-00") {
  const sessions = new Map();
  const assistant = new Map(); // message id -> { session, day, model, usage }

  const get = (o) => {
    const id = o.sessionId;
    let s = sessions.get(id);
    if (!s) {
      s = {
        sessionId: id,
        repo: repoName(o.cwd),
        branch: o.gitBranch && o.gitBranch !== "HEAD" ? o.gitBranch : null,
        startedAt: o.timestamp,
        endedAt: o.timestamp,
        prompts: 0,
        turns: 0,
        toolErrors: 0,
        maxErrorStreak: 0,
        maxContext: 0,
        streak: 0,
      };
      sessions.set(id, s);
    }
    if (o.timestamp) {
      if (!s.startedAt || o.timestamp < s.startedAt) s.startedAt = o.timestamp;
      if (!s.endedAt || o.timestamp > s.endedAt) s.endedAt = o.timestamp;
    }
    if (s.repo === "unknown" && o.cwd) s.repo = repoName(o.cwd);
    return s;
  };

  for (const line of lines) {
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (!o.sessionId || !o.timestamp || (o.type !== "user" && o.type !== "assistant")) continue;
    const s = get(o);

    if (o.type === "assistant") {
      const msg = o.message;
      const u = msg?.usage;
      if (!u || !msg.model || msg.model === "<synthetic>") continue;
      // One API response is logged as several lines (one per content block). Count it once.
      const key = msg.id ?? o.requestId ?? o.uuid;
      const prev = assistant.get(key);
      if (!prev || (u.output_tokens ?? 0) >= (prev.usage.output_tokens ?? 0)) {
        assistant.set(key, { s, day: o.timestamp.slice(0, 10), model: msg.model, usage: u });
      }
    } else {
      if (isPrompt(o)) s.prompts++;
      const c = o.message?.content;
      if (Array.isArray(c)) {
        for (const b of c) {
          if (b?.type !== "tool_result") continue;
          if (b.is_error) {
            s.toolErrors++;
            s.streak++;
            s.maxErrorStreak = Math.max(s.maxErrorStreak, s.streak);
          } else s.streak = 0;
        }
      }
    }
  }

  const usage = new Map(); // session -> Map(day|model -> row)
  for (const { s, day, model, usage: u } of assistant.values()) {
    const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    const write = u.cache_creation_input_tokens ?? 0;
    const t = {
      input: u.input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      cacheWrite: Math.max(0, write - w1h),
      cacheWrite1h: w1h,
      cacheRead: u.cache_read_input_tokens ?? 0,
    };
    s.turns++;
    s.maxContext = Math.max(s.maxContext, t.input + t.cacheWrite + t.cacheWrite1h + t.cacheRead);
    if (day < sinceDay) continue;
    const m = usage.get(s) ?? new Map();
    usage.set(s, m);
    const k = day + "|" + model;
    const row = m.get(k) ?? { day, model, input: 0, output: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, messages: 0 };
    for (const f of ["input", "output", "cacheWrite", "cacheWrite1h", "cacheRead"]) row[f] += t[f];
    row.messages++;
    m.set(k, row);
  }

  const out = [];
  for (const s of sessions.values()) {
    const rows = usage.get(s);
    if (!rows) continue;
    delete s.streak;
    out.push({ ...s, usage: [...rows.values()] });
  }
  return out;
}

export function readSessions(dir, sinceDay) {
  const cutoff = sinceDay ? Date.parse(sinceDay + "T00:00:00Z") : 0;
  const lines = [];
  // Group by session id across files; subagent logs share the parent session id.
  for (const f of jsonlFiles(dir)) {
    try {
      if (statSync(f).mtimeMs < cutoff) continue;
      lines.push(...readFileSync(f, "utf8").split("\n"));
    } catch {
      /* unreadable file: skip */
    }
  }
  return parseLines(lines, sinceDay);
}

// ---------- commands ----------

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v.startsWith("--")) {
      const k = v.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) a[k] = true;
      else a[k] = argv[++i];
    } else a._.push(v);
  }
  return a;
}

function sinceToDay(since) {
  const m = /^(\d+)d$/.exec(since ?? "");
  if (m) return new Date(Date.now() - (Number(m[1]) - 1) * 864e5).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(since ?? "")) return since;
  return null;
}

const usd = (n) => "$" + n.toFixed(2);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function summary(sessions) {
  const byRepo = new Map();
  const byModel = new Map();
  let total = 0;
  for (const s of sessions) {
    for (const u of s.usage) {
      const c = costOf(u.model, u);
      total += c;
      byRepo.set(s.repo, (byRepo.get(s.repo) ?? 0) + c);
      byModel.set(u.model, (byModel.get(u.model) ?? 0) + c);
    }
  }
  const table = (title, map) => {
    console.log(`\n${title}`);
    for (const [k, v] of [...map].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log("  " + pad(k, 40) + lpad(usd(v), 10));
  };
  console.log(`${sessions.length} sessions, estimated cost ${usd(total)}`);
  table("By repo", byRepo);
  table("By model", byModel);
}

async function upload(sessions, url, key) {
  let saved = 0;
  for (let i = 0; i < sessions.length; i += BATCH) {
    const res = await fetch(url.replace(/\/$/, "") + "/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ version: 1, source: "claude-code", sessions: sessions.slice(i, i + BATCH) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Upload failed with HTTP ${res.status}`);
    saved += body.saved ?? 0;
  }
  return saved;
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0] ?? "help";
  const dir = a.dir ?? join(homedir(), ".claude", "projects");
  const sinceDay = sinceToDay(a.since ?? (cmd === "upload" ? "90d" : "30d"));

  if (cmd === "help" || a.help) {
    console.log(`TokenLens CLI

  node tokenlens.mjs scan   [--since 30d] [--dir PATH] [--json]
  node tokenlens.mjs upload --key KEY [--url ${DEFAULT_URL}] [--since 90d]

--since takes Nd (last N days) or YYYY-MM-DD. Env vars: TOKENLENS_KEY, TOKENLENS_URL.`);
    return;
  }
  if (!existsSync(dir)) {
    console.error(`No Claude Code logs found at ${dir}. Use --dir to point at them.`);
    process.exit(1);
  }
  const sessions = readSessions(dir, sinceDay);

  if (cmd === "scan") {
    if (a.json) console.log(JSON.stringify({ version: 1, source: "claude-code", sessions }, null, 2));
    else summary(sessions);
    return;
  }
  if (cmd === "upload") {
    const key = a.key ?? process.env.TOKENLENS_KEY;
    const url = a.url ?? process.env.TOKENLENS_URL ?? DEFAULT_URL;
    if (!key) {
      console.error("Missing --key. Copy your API key from the Setup page.");
      process.exit(1);
    }
    const saved = await upload(sessions, url, key);
    console.log(`Uploaded ${saved} sessions to ${url}`);
    return;
  }
  console.error(`Unknown command "${cmd}". Run with --help.`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("tokenlens.mjs")) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
