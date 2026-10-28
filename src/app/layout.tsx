import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TokenLens: where your AI coding money goes",
  description: "Cost per day, repo and session from your Claude Code logs, plus tips to cut waste.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold text-base">
              Token<span className="text-accent">Lens</span>
            </Link>
            <Link href="/demo" className="text-ink-2 hover:text-ink">
              Demo
            </Link>
            <Link href="/dashboard" className="text-ink-2 hover:text-ink">
              Dashboard
            </Link>
            <Link href="/settings" className="text-ink-2 hover:text-ink">
              Setup
            </Link>
            <div className="ml-auto">
              <UserMenu />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-ink-3">
          Costs are estimates from public API list prices. Your plan may bill differently.
        </footer>
      </body>
    </html>
  );
}
