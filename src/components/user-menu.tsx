import { auth, authEnabled, signIn, signOut } from "@/auth";

export async function UserMenu() {
  if (!authEnabled) return <span className="text-xs text-ink-3">Demo mode</span>;
  const session = await auth();
  if (!session?.user) {
    return (
      <form action={async () => { "use server"; await signIn("github", { redirectTo: "/dashboard" }); }}>
        <button className="rounded-md bg-ink px-3 py-1.5 text-bg hover:opacity-90">Sign in with GitHub</button>
      </form>
    );
  }
  return (
    <form
      className="flex items-center gap-3"
      action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}
    >
      <span className="text-ink-2">{session.user.name}</span>
      <button className="text-ink-3 hover:text-ink">Sign out</button>
    </form>
  );
}
