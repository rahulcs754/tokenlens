import Link from "next/link";
import { DashboardView } from "@/components/dashboard-view";
import { buildDashboard } from "@/lib/aggregate";
import { parseFilters } from "@/lib/dates";
import { demoSessions } from "@/lib/demo";

export const metadata = { title: "Demo · TokenLens" };

export default async function DemoPage({ searchParams }: PageProps<"/demo">) {
  const data = buildDashboard(demoSessions(), parseFilters(await searchParams));
  return (
    <DashboardView
      data={data}
      banner={
        <div className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink-2">
          Sample data from a made-up team. <Link href="/settings" className="text-accent hover:underline">Set up the CLI</Link> to see your own.
        </div>
      }
    />
  );
}
