import { formatUnits, lamportsToSol, shortAddr, signed } from "./format";
import { KNOWN_MINTS, KNOWN_PROGRAMS } from "./programs";
import type { DecodedIx, DecodedTx, TokenChange } from "./types";

// ~4 chars per token for this kind of text, so 20k chars is ~5k tokens: under the
// ~6k-token target with headroom for the system prompt.
export const SUMMARY_CHAR_BUDGET = 20_000;
const LINE_CAP = 500;
const LOG_LINES = 30;
const ROW_CAP = 30;

const B58_STRING = /"([1-9A-HJ-NP-Za-km-z]{32,44})"/g;
const B58_BARE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

const KNOWN_NAMES: Record<string, string> = { ...KNOWN_PROGRAMS, ...KNOWN_MINTS };

/** Verified name for a known program or mint, else the short AbCd…WxYz form. */
const label = (a: string) => KNOWN_NAMES[a] ?? shortAddr(a);

// Logs name programs by raw ID ("Program Tokenkeg... invoke [1]"). Swap in the verified name,
// or the short form, so the model does not read a known program as unknown.
const logLine = (l: string) => l.replace(B58_BARE, label);

function infoText(info: unknown): string {
  const json = JSON.stringify(info, (key, v) =>
    key === "lamports" && typeof v === "number" ? `${v} lamports (${lamportsToSol(v)} SOL)` : v,
  );
  return (json ?? "").replace(B58_STRING, (_, a: string) => `"${label(a)}"`);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Known address -> name rewrites for model output, built once.
const NAME_REWRITES: [RegExp, string][] = Object.entries(KNOWN_NAMES).flatMap(([addr, name]) => {
  const n = escapeRe(name);
  const s = escapeRe(shortAddr(addr));
  const a = escapeRe(addr);
  return [
    // "USDC (EPjF…Dt1v)" / "EPjF…Dt1v (USDC)" -> "USDC", so the name is not doubled
    [new RegExp(`${n}\\s*\\(\\s*(?:${s}|${a})\\s*\\)`, "g"), name],
    [new RegExp(`(?:${s}|${a})\\s*\\(\\s*${n}\\s*\\)`, "g"), name],
    [new RegExp(`\\b${a}\\b`, "g"), name],
    [new RegExp(s, "g"), name],
  ] as [RegExp, string][];
});

/**
 * The model is given names for known programs and mints but can still echo an address
 * (e.g. "1123.03 of the EPjF…Dt1v token"). Rewrite every known address, short or full,
 * to its name. Unknown addresses are left as they are.
 */
export function nameKnownAddresses(text: string): string {
  return NAME_REWRITES.reduce((t, [re, name]) => t.replace(re, name), text);
}

function ixLine(ix: DecodedIx): string {
  const who = ix.known ? ix.program : `UNKNOWN program (${shortAddr(ix.programId)})`;
  const indent = "  ".repeat(ix.depth);
  const what = ix.type ? ` ${ix.type}` : " (not parsed by RPC)";
  const detail =
    ix.info !== undefined ? ` ${infoText(ix.info)}`
    : ` (raw: ${ix.accounts?.length ?? 0} accounts, ${(ix.data ?? "").length} base58 characters of instruction data)`;
  return `${indent}#${ix.index} ${who}${what}${detail}`;
}

// Known mints go in by name only, so the model has no address to echo back.
const mintLabel = (m: string) => KNOWN_MINTS[m] ?? `${shortAddr(m)} (unknown token)`;

// TokenChange.delta is an exact decimal string; rescale it to integer units to sum and compare without floats.
function units(t: TokenChange): bigint {
  const [whole, frac = ""] = t.delta.replace("-", "").split(".");
  return BigInt(whole + frac.padEnd(t.decimals, "0")) * (t.delta.startsWith("-") ? -1n : 1n);
}
const abs = (n: bigint) => (n < 0n ? -n : n);

/** What the fee payer ended up sending and receiving: the one-line story of most transactions. */
function feePayerNet(d: DecodedTx): string[] {
  const sol = d.solChanges.find((c) => c.address === d.feePayer)?.delta ?? 0;
  const byMint = new Map<string, { raw: bigint; decimals: number }>();
  for (const t of d.tokenChanges) {
    if (t.owner !== d.feePayer) continue;
    const cur = byMint.get(t.mint) ?? { raw: 0n, decimals: t.decimals };
    byMint.set(t.mint, { raw: cur.raw + units(t), decimals: t.decimals });
  }

  // Spelled out as "sent"/"received" so the model never has to interpret a sign.
  const flow = (amount: bigint, what: string, decimals: number) =>
    amount < 0n ? `sent ${formatUnits(-amount, decimals)} ${what}` : `received ${formatUnits(amount, decimals)} ${what}`;
  const lines = [
    `SOL: ${flow(BigInt(sol), "SOL", 9)} net, including the ${lamportsToSol(d.feeLamports)} SOL fee`,
    ...(byMint.size
      ? [...byMint].map(([mint, v]) => `token: ${flow(v.raw, `of ${mintLabel(mint)}`, v.decimals)}`)
      : ["no token balance changes owned by the fee payer"]),
  ];

  // Decided here, not by the model: Llama labels plain transfers as arbitrage if left to judge.
  // ponytail: 1% threshold is a heuristic; a swap with a tiny price impact on a huge pool could trip it.
  const largestOther = (mint: string) =>
    d.tokenChanges.filter((t) => t.mint === mint && t.owner !== d.feePayer).reduce((m, t) => (abs(units(t)) > m ? abs(units(t)) : m), 0n);
  const roundTrip = byMint.size > 0 && [...byMint].every(([mint, v]) => abs(v.raw) * 100n < largestOther(mint));
  if (roundTrip) {
    lines.push("pattern: ROUND TRIP. The fee payer's net token changes are under 1% of the amounts that moved between other accounts, which is what a round-trip route such as arbitrage looks like.");
  }
  return lines;
}

/** Compact, size-capped text for the LLM. Sections are in priority order, so truncation drops logs first. */
export function buildSummary(d: DecodedTx): string {
  const out: string[] = [];
  let used = 0;
  // Content lines leave MARKER_RESERVE free so a truncation marker always fits after them.
  const MARKER_RESERVE = 64;
  const push = (line: string, reserve = MARKER_RESERVE): boolean => {
    const l = line.length > LINE_CAP ? `${line.slice(0, LINE_CAP)}…` : line;
    if (used + l.length + 1 > SUMMARY_CHAR_BUDGET - reserve) return false;
    out.push(l);
    used += l.length + 1;
    return true;
  };
  const omitted = (n: number) => push(`… ${n} more omitted`, 0);
  const list = (items: string[], cap = Infinity) => {
    const shown = Math.min(items.length, cap);
    for (let i = 0; i < shown; i++) {
      if (!push(items[i]!)) return void omitted(items.length - i);
    }
    if (items.length > shown) omitted(items.length - shown);
  };

  push("## Overview");
  list([
    `signature: ${shortAddr(d.signature)}`,
    `cluster: ${d.cluster}`,
    `status: ${d.success ? "success" : `FAILED. ${d.error}`}`,
    `slot: ${d.slot}`,
    `block time: ${d.blockTimeIso ?? "unknown"}`,
    `fee: ${lamportsToSol(d.feeLamports)} SOL (${d.feeLamports} lamports)`,
    `compute units consumed: ${d.computeUnits ?? "unknown"}`,
    `version: ${d.version}`,
    `fee payer: ${shortAddr(d.feePayer)}`,
    `signers: ${d.signers.map(shortAddr).join(", ")}`,
  ]);

  push(`\n## Fee payer (${shortAddr(d.feePayer)}) net changes`);
  list(feePayerNet(d));

  if (d.errorLogs.length) {
    push("\n## Log lines that mention the failure");
    list(d.errorLogs.map(logLine), 10);
  }

  push("\n## SOL balance changes (accounts with no change omitted)");
  list(
    d.solChanges.length
      ? d.solChanges.map((c) => `${shortAddr(c.address)}: ${lamportsToSol(c.pre)} -> ${lamportsToSol(c.post)} SOL (${signed(lamportsToSol(c.delta))})`)
      : ["none"],
    ROW_CAP,
  );

  push("\n## Token balance changes");
  list(
    d.tokenChanges.length
      ? d.tokenChanges.map((t) => `owner ${t.owner ? shortAddr(t.owner) : "unknown"}, mint ${mintLabel(t.mint)}: ${t.pre} -> ${t.post} (${signed(t.delta)})`)
      : ["none"],
    ROW_CAP,
  );

  push("\n## Instructions (in execution order; indented lines are inner/CPI calls)");
  list(d.instructions.flatMap((ix) => [ixLine(ix), ...ix.inner.map(ixLine)]));

  push(`\n## Program logs (first ${Math.min(LOG_LINES, d.logs.length)} of ${d.logs.length})`);
  list(d.logs.length ? d.logs.map(logLine) : ["none"], LOG_LINES);

  return out.join("\n");
}
