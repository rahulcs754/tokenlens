import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { hasDb, upsertUser } from "@/lib/db";

// Login needs a GitHub OAuth app and a database. Without them the site runs in demo mode.
export const authEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET && hasDb());

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      // First sign-in: create or update the user row and remember its id in the token.
      if (profile && hasDb()) {
        const user = await upsertUser({
          githubId: String(profile.id),
          login: String(profile.login ?? profile.name ?? "user"),
          name: profile.name ?? null,
          avatar: (profile.avatar_url as string | undefined) ?? null,
        });
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      return { ...session, userId: typeof token.userId === "number" ? token.userId : undefined };
    },
  },
});

// The signed-in user's DB id, or null.
export async function currentUserId(): Promise<number | null> {
  if (!authEnabled) return null;
  const session = (await auth()) as { userId?: number } | null;
  return session?.userId ?? null;
}
