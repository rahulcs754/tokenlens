import Link from "next/link";
import { redirect } from "next/navigation";
import { authEnabled, currentUserId } from "@/auth";
import { DashboardView } from "@/components/dashboard-view";
import { buildDashboard } from "@/lib/aggregate";
import { daysAgo, parseFilters } from "@/lib/dates";
import { loadSessions } from "@/lib/db";

export const metadata = { title: "Dashboard · TokenLens" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  if (!authEnabled) redirect("/demo");
  const userId = await currentUserId();
  if (!userId) redirect("/api/auth/signin?callbackUrl=/dashboard");

  const filters = parseFilters(await searchParams);
  // Load a wider window than the range so the repo/model dropdowns stay stable.
  const from = filters.from < daysAgo(365) ? filters.from : daysAgo(365);
  const sessions = await loadSessions(userId, from, filters.to);
  if (sessions.length === 0) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-lg font-semibold">No data yet</h1>
        <p className="mt-2 text-ink-2">Upload your Claude Code logs with the CLI and they will show up here.</p>
        <Link href="/settings" className="mt-4 inline-block rounded-md bg-ink px-4 py-2 text-sm text-bg">
          Get your API key
        </Link>
      </div>
    );
  }
  return <DashboardView data={buildDashboard(sessions, filters)} />;
}
