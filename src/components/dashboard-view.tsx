import { Suspense } from "react";
import type { Dashboard } from "@/lib/aggregate";
import { compact, pct, shortModel, usd } from "@/lib/format";
import { CostBars, CostByDay } from "./charts";
import { FilterBar } from "./filter-bar";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      <h2 className="mb-3 text-sm font-medium text-ink-2">{title}</h2>
      {children}
    </section>
  );
}

export function DashboardView({ data, banner }: { data: Dashboard; banner?: React.ReactNode }) {
  const { totals, tips } = data;
  const savings = tips.reduce((n, t) => n + t.estSavings, 0);
  return (
    <div className="space-y-5">
      {banner}
      <Suspense>
        <FilterBar filters={data.filters} repos={data.repos} models={data.models} />
      </Suspense>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Total cost" value={usd(totals.cost)} sub={`${data.filters.from} to ${data.filters.to}`} />
        <Tile label="Tokens" value={compact(totals.tokens)} sub={`${pct(totals.cacheHitRate)} served from cache`} />
        <Tile label="Sessions" value={String(totals.sessions)} sub={`${usd(totals.costPerSession)} per session`} />
        <Tile label="Possible savings" value={usd(savings)} sub="from the 3 waste tips below" />
      </div>

      {totals.sessions === 0 ? (
        <div className="card p-10 text-center text-ink-2">No usage in this range. Try a wider date range or clear filters.</div>
      ) : (
        <>
          <Panel title="Cost per day, by model family">
            <CostByDay data={data.byDay} />
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel title="Cost per repo">
              <CostBars data={data.byRepo} />
            </Panel>
            <Panel title="Model mix (cost)">
              <CostBars data={data.byModel} byModel />
            </Panel>
          </div>

          <Panel title="Waste tips">
            <ul className="grid gap-3 md:grid-cols-3">
              {tips.map((t) => (
                <li key={t.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{t.title}</span>
                    <span className="text-sm tabular-nums text-ink-2">~{usd(t.estSavings)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{t.advice}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={`Sessions (top ${Math.min(20, data.sessions.length)} by cost)`}>
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-ink-3">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-normal">Started</th>
                    <th className="px-2 py-2 font-normal">Repo</th>
                    <th className="px-2 py-2 font-normal">Main model</th>
                    <th className="px-2 py-2 text-right font-normal">Prompts</th>
                    <th className="px-2 py-2 text-right font-normal">Tokens</th>
                    <th className="px-2 py-2 text-right font-normal">Cost</th>
                    <th className="px-4 py-2 font-normal">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.slice(0, 20).map((s) => (
                    <tr key={s.sessionId} className="border-b border-line last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 text-ink-2">
                        {new Date(s.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">{s.repo}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-ink-2">{shortModel(s.mainModel)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{s.prompts}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{compact(s.tokens)}</td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums">{usd(s.cost)}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {s.flags.map((f) => (
                            <span key={f} className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-2">
                              ⚠ {f}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
