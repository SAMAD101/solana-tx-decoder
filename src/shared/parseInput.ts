import type { Cluster } from "./types";

export type ParseResult = { ok: true; signature: string; cluster: Cluster } | { ok: false; error: string };

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const HOSTS = ["solscan.io", "explorer.solana.com", "solana.fm"];

// solscan: ?cluster=devnet  explorer: ?cluster=devnet|testnet  solana.fm: ?cluster=devnet-solana|...
const CLUSTERS: Record<string, Cluster> = {
  "": "mainnet-beta",
  mainnet: "mainnet-beta",
  "mainnet-beta": "mainnet-beta",
  "mainnet-solana": "mainnet-beta",
  "mainnet-alpha": "mainnet-beta",
  devnet: "devnet",
  "devnet-solana": "devnet",
  testnet: "testnet",
  "testnet-solana": "testnet",
};

const fail = (error: string): ParseResult => ({ ok: false, error });

export function parseInput(raw: string): ParseResult {
  let s = raw.trim();
  if (!s) return fail("Paste a transaction signature or an explorer link.");

  let signature = s;
  let clusterParam = "";

  // Accept links pasted without the scheme, e.g. "solscan.io/tx/...".
  if (/^(www\.)?(solscan\.io|explorer\.solana\.com|solana\.fm)\//i.test(s)) s = `https://${s}`;

  if (/^https?:\/\//i.test(s)) {
    let url: URL;
    try {
      url = new URL(s);
    } catch {
      return fail("That link could not be read as a URL.");
    }
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!HOSTS.includes(host)) {
      return fail(`Unsupported site "${host}". Use a solscan.io, explorer.solana.com or solana.fm transaction link, or a raw signature.`);
    }
    const m = url.pathname.match(/^\/tx\/([^/]+)\/?$/);
    if (!m) return fail("That link is not a transaction page (expected /tx/<signature>).");
    signature = decodeURIComponent(m[1]!);
    clusterParam = (url.searchParams.get("cluster") ?? "").toLowerCase();
  } else if (/\s/.test(s)) {
    return fail("A signature cannot contain spaces.");
  }

  if (!BASE58.test(signature)) {
    return fail("Signature is not valid base58 (it cannot contain 0, O, I or l, or any punctuation).");
  }
  if (signature.length < 87 || signature.length > 88) {
    return fail(`A transaction signature is 87 or 88 characters; this one is ${signature.length}.`);
  }

  const cluster = CLUSTERS[clusterParam];
  if (!cluster) return fail(`Unknown cluster "${clusterParam}". Supported: mainnet-beta, devnet, testnet.`);

  return { ok: true, signature, cluster };
}

/** Canonical input for a (signature, cluster) pair, so re-running a recent lookup goes through explain(input). */
export function toInput(signature: string, cluster: Cluster): string {
  return cluster === "mainnet-beta" ? signature : `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}
