import "server-only";
import postgres from "postgres";
import { SCHEMA } from "./schema";
import type { SessionRecord } from "./types";

// Works with Neon and Supabase connection strings. Null when no DB is set (demo mode).
const url = process.env.DATABASE_URL;
const g = globalThis as unknown as { __sql?: postgres.Sql };
export const sql: postgres.Sql | null = url
  ? (g.__sql ??= postgres(url, { ssl: url.includes("localhost") ? false : "require", max: 3, prepare: false }))
  : null;

export const hasDb = () => sql !== null;

let ready: Promise<unknown> | null = null;

async function getDb() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  ready ??= sql.unsafe(SCHEMA).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return sql;
}

export type DbUser = { id: number; login: string; name: string | null; avatar_url: string | null; api_key: string };

export async function upsertUser(u: { githubId: string; login: string; name?: string | null; avatar?: string | null }) {
  const db = await getDb();
  const key = "tl_" + crypto.randomUUID().replace(/-/g, "");
  const [row] = await db<DbUser[]>`
    insert into users (github_id, login, name, avatar_url, api_key)
    values (${u.githubId}, ${u.login}, ${u.name ?? null}, ${u.avatar ?? null}, ${key})
    on conflict (github_id) do update set login = excluded.login, name = excluded.name, avatar_url = excluded.avatar_url
    returning id, login, name, avatar_url, api_key`;
  return row;
}

export async function getUser(id: number) {
  const [row] = await (await getDb())<DbUser[]>`select id, login, name, avatar_url, api_key from users where id = ${id}`;
  return row ?? null;
}

export async function userByKey(key: string) {
  const [row] = await (await getDb())<{ id: number }[]>`select id from users where api_key = ${key}`;
  return row ?? null;
}

export async function rotateKey(id: number) {
  const key = "tl_" + crypto.randomUUID().replace(/-/g, "");
  await (await getDb())`update users set api_key = ${key} where id = ${id}`;
  return key;
}

// Idempotent: uploading the same logs twice overwrites, it never double counts.
export async function saveSessions(userId: number, sessions: SessionRecord[]) {
  const db = await getDb();
  await db.begin(async (tx) => {
    for (const s of sessions) {
      await tx`
        insert into sessions (user_id, session_id, repo, branch, started_at, ended_at, prompts, turns, tool_errors, max_error_streak, max_context)
        values (${userId}, ${s.sessionId}, ${s.repo}, ${s.branch}, ${s.startedAt}, ${s.endedAt}, ${s.prompts}, ${s.turns}, ${s.toolErrors}, ${s.maxErrorStreak}, ${s.maxContext})
        on conflict (user_id, session_id) do update set
          repo = excluded.repo, branch = excluded.branch, started_at = excluded.started_at, ended_at = excluded.ended_at,
          prompts = excluded.prompts, turns = excluded.turns, tool_errors = excluded.tool_errors,
          max_error_streak = excluded.max_error_streak, max_context = excluded.max_context, updated_at = now()`;
      await tx`delete from usage where user_id = ${userId} and session_id = ${s.sessionId}`;
      if (s.usage.length) {
        await tx`insert into usage ${tx(
          s.usage.map((u) => ({
            user_id: userId,
            session_id: s.sessionId,
            day: u.day,
            model: u.model,
            input: u.input,
            output: u.output,
            cache_write: u.cacheWrite,
            cache_write_1h: u.cacheWrite1h ?? 0,
            cache_read: u.cacheRead,
            messages: u.messages,
          })),
        )}`;
      }
    }
  });
}

type Row = {
  session_id: string;
  repo: string;
  branch: string | null;
  started_at: Date;
  ended_at: Date;
  prompts: number;
  turns: number;
  tool_errors: number;
  max_error_streak: number;
  max_context: number;
  day: string;
  model: string;
  input: string;
  output: string;
  cache_write: string;
  cache_write_1h: string;
  cache_read: string;
  messages: number;
};

// Loads every session that has usage in the range. Aggregation happens in buildDashboard.
export async function loadSessions(userId: number, from: string, to: string): Promise<SessionRecord[]> {
  const rows = await (await getDb())<Row[]>`
    select s.session_id, s.repo, s.branch, s.started_at, s.ended_at, s.prompts, s.turns, s.tool_errors,
           s.max_error_streak, s.max_context, to_char(u.day, 'YYYY-MM-DD') as day, u.model,
           u.input, u.output, u.cache_write, u.cache_write_1h, u.cache_read, u.messages
    from sessions s join usage u on u.user_id = s.user_id and u.session_id = s.session_id
    where s.user_id = ${userId} and u.day between ${from} and ${to}`;
  const map = new Map<string, SessionRecord>();
  for (const r of rows) {
    let s = map.get(r.session_id);
    if (!s) {
      s = {
        sessionId: r.session_id,
        repo: r.repo,
        branch: r.branch,
        startedAt: r.started_at.toISOString(),
        endedAt: r.ended_at.toISOString(),
        prompts: r.prompts,
        turns: r.turns,
        toolErrors: r.tool_errors,
        maxErrorStreak: r.max_error_streak,
        maxContext: r.max_context,
        usage: [],
      };
      map.set(r.session_id, s);
    }
    s.usage.push({
      day: r.day,
      model: r.model,
      input: Number(r.input),
      output: Number(r.output),
      cacheWrite: Number(r.cache_write),
      cacheWrite1h: Number(r.cache_write_1h),
      cacheRead: Number(r.cache_read),
      messages: r.messages,
    });
  }
  return [...map.values()];
}
