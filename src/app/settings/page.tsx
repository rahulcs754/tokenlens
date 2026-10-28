import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { authEnabled, currentUserId } from "@/auth";
import { getUser, rotateKey } from "@/lib/db";

export const metadata = { title: "Setup · TokenLens" };

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-md bg-bg p-3 font-mono text-xs leading-relaxed">{children}</pre>;
}

export default async function SettingsPage() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const userId = await currentUserId();
  const user = userId ? await getUser(userId) : null;

  async function rotate() {
    "use server";
    const id = await currentUserId();
    if (id) await rotateKey(id);
    revalidatePath("/settings");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold">Set up the CLI</h1>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">1. See your numbers locally (no account needed)</h2>
        <p className="text-sm text-ink-2">
          The CLI reads Claude Code logs in <code>~/.claude/projects</code>. Nothing leaves your machine with <code>scan</code>.
        </p>
        <Code>{`curl -fsSL ${origin}/tokenlens.mjs -o tokenlens.mjs\nnode tokenlens.mjs scan --since 30d`}</Code>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-medium">2. Upload to your dashboard</h2>
        {!authEnabled ? (
          <p className="text-sm text-ink-2">
            This server runs in demo mode (no database or GitHub login set). See the README to add them. Meanwhile, try the{" "}
            <Link href="/demo" className="text-accent hover:underline">demo</Link>.
          </p>
        ) : !user ? (
          <p className="text-sm text-ink-2">Sign in with GitHub (top right) to get your API key.</p>
        ) : (
          <>
            <p className="text-sm text-ink-2">Your API key. Keep it private; anyone with it can upload to your dashboard.</p>
            <Code>{user.api_key}</Code>
            <Code>{`node tokenlens.mjs upload --url ${origin} --key ${user.api_key}`}</Code>
            <p className="text-sm text-ink-2">
              Only token counts, model names, repo names and timestamps are sent. Never prompts, code or file paths.
              Re-running is safe: sessions are updated, not doubled.
            </p>
            <form action={rotate}>
              <button className="text-sm text-accent hover:underline">Make a new key (old one stops working)</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
