export const usd = (n: number) =>
  n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(n >= 1 ? 2 : 3)}`;

export function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.round(n));
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const shortModel = (m: string) => m.replace(/^claude-/, "");
