import Link from "next/link";

const FEATURES = [
  ["Cost per day, repo and session", "See exactly which project and which session burned the money."],
  ["Model mix", "How much went to Opus vs Sonnet vs Haiku, and whether it had to."],
  ["Waste tips", "Flags huge contexts, retry loops and pricey models on simple tasks, with a dollar estimate."],
  ["Private by design", "The CLI sends token counts only. No prompts, no code, no file paths."],
];

export default function Home() {
  return (
    <div className="space-y-12 py-8">
      <section className="max-w-2xl space-y-5">
        <h1 className="text-4xl font-semibold tracking-tight">Where does your AI coding money go?</h1>
        <p className="text-lg text-ink-2">
          TokenLens reads your Claude Code session logs and shows tokens and cost per day, per repo and per session.
          Then it points at the waste.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/demo" className="rounded-md bg-ink px-4 py-2 text-bg hover:opacity-90">
            View live demo
          </Link>
          <Link href="/settings" className="rounded-md border border-line bg-surface px-4 py-2 hover:bg-bg">
            Use it on my logs
          </Link>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(([t, d]) => (
          <div key={t} className="card p-5">
            <h2 className="font-medium">{t}</h2>
            <p className="mt-1 text-sm text-ink-2">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
