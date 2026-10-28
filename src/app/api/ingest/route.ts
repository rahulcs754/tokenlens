import { hasDb, saveSessions, userByKey } from "@/lib/db";
import type { IngestPayload, SessionRecord } from "@/lib/types";

const MAX_SESSIONS = 5000;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Validate by hand: the payload is small and flat, and we never trust the client.
function clean(raw: unknown): SessionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const sessionId = str(s.sessionId, 100);
  const startedAt = new Date(str(s.startedAt));
  const endedAt = new Date(str(s.endedAt));
  if (!sessionId || isNaN(+startedAt) || isNaN(+endedAt) || !Array.isArray(s.usage)) return null;
  const usage = s.usage
    .map((u: Record<string, unknown>) => ({
      day: str(u?.day, 10),
      model: str(u?.model, 100),
      input: num(u?.input),
      output: num(u?.output),
      cacheWrite: num(u?.cacheWrite),
      cacheWrite1h: num(u?.cacheWrite1h),
      cacheRead: num(u?.cacheRead),
      messages: num(u?.messages),
    }))
    .filter((u) => DAY.test(u.day) && u.model);
  return {
    sessionId,
    repo: str(s.repo) || "unknown",
    branch: str(s.branch) || null,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    prompts: num(s.prompts),
    turns: num(s.turns),
    toolErrors: num(s.toolErrors),
    maxErrorStreak: num(s.maxErrorStreak),
    maxContext: num(s.maxContext),
    usage,
  };
}

export async function POST(req: Request) {
  if (!hasDb()) return Response.json({ error: "This TokenLens server has no database yet." }, { status: 503 });
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const user = key ? await userByKey(key) : null;
  if (!user) return Response.json({ error: "Invalid API key. Copy it from Settings." }, { status: 401 });

  let body: IngestPayload;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!Array.isArray(body?.sessions)) return Response.json({ error: "Missing sessions array." }, { status: 400 });
  if (body.sessions.length > MAX_SESSIONS)
    return Response.json({ error: `Send at most ${MAX_SESSIONS} sessions per request.` }, { status: 413 });

  const sessions = body.sessions.map(clean).filter((s): s is SessionRecord => s !== null);
  await saveSessions(user.id, sessions);
  return Response.json({ saved: sessions.length, skipped: body.sessions.length - sessions.length });
}
