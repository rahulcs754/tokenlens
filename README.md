# TokenLens

See where your AI coding money goes. TokenLens reads your Claude Code session logs and shows tokens and cost **per day, per repo and per session**, the **model mix**, and **waste tips** with a dollar estimate.

- **Live demo:** _(set after first deploy)_
- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind 4, Recharts, Postgres (Neon or Supabase), Auth.js GitHub login, Vercel.

## How it works

```
~/.claude/projects/*.jsonl  ->  CLI (local, zero deps)  ->  POST /api/ingest  ->  Postgres  ->  dashboard
```

1. The **CLI** (`cli/tokenlens.mjs`) walks `~/.claude/projects`, groups log lines by session, dedupes split API messages, and sums tokens per day and model. It also counts prompts, failed tool calls (and the longest failing streak) and the largest context sent in one request.
2. It uploads only numbers, model names, repo names (from the git remote), branch and timestamps. **No prompts, code or file paths.**
3. The **dashboard** prices usage with `src/lib/pricing.ts` (public API list prices) and runs the waste rules in `src/lib/waste.ts`.

### Waste tips (3 rules)

| Rule | Flags a session when | Estimated saving |
|---|---|---|
| Huge context | one request carried 150k+ tokens | input-side cost above a 60k-token context |
| Repeated failed loops | 3+ failed tool calls in a row | cost share of the failed turns |
| Expensive model, simple task | Opus or Fable, 3 or fewer prompts, under 8k output tokens | cost difference vs Sonnet 5.5 |

## Use the CLI

```bash
curl -fsSL https://YOUR-DEPLOYMENT/tokenlens.mjs -o tokenlens.mjs
node tokenlens.mjs scan --since 30d            # local summary, nothing is sent
node tokenlens.mjs scan --json > usage.json    # the exact payload upload would send
node tokenlens.mjs upload --url https://YOUR-DEPLOYMENT --key tl_...   # key from the Setup page
```

Uploading is idempotent: re-running updates sessions instead of double counting.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000, demo mode with sample data
npm test        # CLI parser, pricing parity, dashboard math
```

## Turn on login and real data

Without these env vars the site runs in **demo mode** (`/demo` with sample data). Set all four to enable GitHub login, the API key and uploads:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon or Supabase Postgres connection string (tables are created on first use) |
| `AUTH_SECRET` | `npx auth secret` or `openssl rand -base64 32` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub, Settings, Developer settings, OAuth Apps. Callback URL: `https://YOUR-DEPLOYMENT/api/auth/callback/github` |

## Project layout

```
cli/tokenlens.mjs          CLI (copied to public/ at build so users can curl it)
src/lib/pricing.ts         model prices and families
src/lib/aggregate.ts       all dashboard numbers (pure, tested)
src/lib/waste.ts           the 3 waste rules
src/lib/db.ts, schema.ts   Postgres access, auto-created schema
src/app/api/ingest         upload endpoint (Bearer API key)
src/app/demo, dashboard    dashboard pages
```

## Roadmap

Codex and Cursor log readers, team view (several developers per org), weekly email digest.
