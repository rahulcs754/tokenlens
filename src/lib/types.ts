// Shape the CLI uploads and the DB stores. One session can span several days and models.
export type UsageRow = {
  day: string; // YYYY-MM-DD (UTC)
  model: string;
  input: number;
  output: number;
  cacheWrite: number; // 5-minute cache writes
  cacheWrite1h?: number; // 1-hour cache writes
  cacheRead: number;
  messages: number;
};

export type SessionRecord = {
  sessionId: string;
  repo: string;
  branch: string | null;
  startedAt: string; // ISO
  endedAt: string; // ISO
  prompts: number; // user-typed prompts
  turns: number; // assistant API calls
  toolErrors: number;
  maxErrorStreak: number; // longest run of failed tool calls in a row
  maxContext: number; // largest single-request context, in tokens
  usage: UsageRow[];
};

export type IngestPayload = { version: 1; source?: string; sessions: SessionRecord[] };

export type Filters = { from: string; to: string; repo: string | null; model: string | null };
