"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Filters } from "@/lib/types";

const PRESETS = [7, 30, 90];

function iso(daysBack: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

export function FilterBar({ filters, repos, models }: { filters: Filters; repos: string[]; models: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const field = "rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink";
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex rounded-md border border-line bg-surface p-0.5 text-sm">
        {PRESETS.map((d) => {
          const active = filters.from === iso(d - 1) && filters.to === iso(0);
          return (
            <button
              key={d}
              onClick={() => set({ from: iso(d - 1), to: iso(0) })}
              className={`rounded px-2.5 py-1 ${active ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
            >
              {d}d
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink-3">
        From
        <input type="date" className={field} value={filters.from} max={filters.to} onChange={(e) => set({ from: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-3">
        To
        <input type="date" className={field} value={filters.to} min={filters.from} onChange={(e) => set({ to: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-3">
        Repo
        <select className={field} value={filters.repo ?? ""} onChange={(e) => set({ repo: e.target.value || null })}>
          <option value="">All repos</option>
          {repos.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-3">
        Model
        <select className={field} value={filters.model ?? ""} onChange={(e) => set({ model: e.target.value || null })}>
          <option value="">All models</option>
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      {(filters.repo || filters.model) && (
        <button onClick={() => set({ repo: null, model: null })} className="pb-2 text-sm text-accent hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
