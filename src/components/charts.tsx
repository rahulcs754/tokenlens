"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayPoint, NamedCost } from "@/lib/aggregate";
import { familyOf, FAMILIES, type Family } from "@/lib/pricing";
import { compact, shortModel, usd } from "@/lib/format";

// Color follows the model family, never its rank, so filters don't repaint series.
export const FAMILY_COLOR: Record<Family, string> = {
  Opus: "var(--s1)",
  Sonnet: "var(--s2)",
  Haiku: "var(--s3)",
  Fable: "var(--s4)",
  Other: "var(--s5)",
};

const axis = { fontSize: 11, fill: "var(--text-3)" };

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">{children}</div>
  );
}

export function Legend({ families }: { families: Family[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-ink-2">
      {families.map((f) => (
        <span key={f} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FAMILY_COLOR[f] }} />
          {f}
        </span>
      ))}
    </div>
  );
}

export function CostByDay({ data }: { data: DayPoint[] }) {
  const present = FAMILIES.filter((f) => data.some((d) => d[f] > 0));
  const shortDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div className="space-y-3">
      <Legend families={present} />
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="day" tickFormatter={shortDay} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickFormatter={(v) => usd(v)} tick={axis} tickLine={false} axisLine={false} width={56} />
            <Tooltip
              cursor={{ fill: "var(--grid)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <Box>
                    <div className="mb-1 font-medium text-ink">{shortDay(String(label))}</div>
                    {present.map((f) => {
                      const v = (payload[0].payload as DayPoint)[f];
                      return v > 0 ? (
                        <div key={f} className="flex items-center justify-between gap-4 text-ink-2">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: FAMILY_COLOR[f] }} />
                            {f}
                          </span>
                          <span className="tabular-nums text-ink">{usd(v)}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="mt-1 border-t border-line pt-1 text-right font-medium tabular-nums text-ink">
                      {usd((payload[0].payload as DayPoint).total)}
                    </div>
                  </Box>
                ) : null
              }
            />
            {present.map((f) => (
              <Bar key={f} dataKey={f} stackId="cost" fill={FAMILY_COLOR[f]} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CostBars({ data, byModel = false }: { data: NamedCost[]; byModel?: boolean }) {
  const rows = data.slice(0, 8);
  const label = (n: string) => (byModel ? shortModel(n) : n);
  return (
    <div style={{ height: Math.max(120, rows.length * 36 + 16) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tickFormatter={label} tick={axis} tickLine={false} axisLine={false} width={130} />
          <Tooltip
            cursor={{ fill: "var(--grid)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <Box>
                  <div className="font-medium text-ink">{label(String((payload[0].payload as NamedCost).name))}</div>
                  <div className="text-ink-2">
                    {usd((payload[0].payload as NamedCost).cost)} · {compact((payload[0].payload as NamedCost).tokens)} tokens
                  </div>
                </Box>
              ) : null
            }
          />
          <Bar
            dataKey="cost"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{ position: "right", formatter: (v: unknown) => usd(Number(v)), fontSize: 11, fill: "var(--text-2)" }}
          >
            {rows.map((r) => (
              <Cell key={r.name} fill={byModel ? FAMILY_COLOR[familyOf(r.name)] : "var(--s1)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
