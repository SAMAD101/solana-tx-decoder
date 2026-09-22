import type { Cluster } from "./types";

export const shortAddr = (a: string) =>
  a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;

export function formatUnits(amount: bigint, decimals: number): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = decimals
    ? (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "")
    : "";
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export const lamportsToSol = (lamports: number) =>
  formatUnits(BigInt(lamports), 9);

/** "+1.5" / "-0.2" / "0" */
export const signed = (s: string) =>
  s.startsWith("-") || s === "0" ? s : `+${s}`;

export function relativeTime(unixSeconds: number, nowMs = Date.now()): string {
  const diff = Math.round(nowMs / 1000 - unixSeconds);
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [31536000, "year"],
    [2592000, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [secs, name] of units) {
    if (abs >= secs) {
      const n = Math.floor(abs / secs);
      const label = `${n} ${name}${n === 1 ? "" : "s"}`;
      return diff >= 0 ? `${label} ago` : `in ${label}`;
    }
  }
  return "just now";
}

export function solscanUrl(
  kind: "tx" | "account",
  id: string,
  cluster: Cluster,
): string {
  const q = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://solscan.io/${kind}/${id}${q}`;
}
