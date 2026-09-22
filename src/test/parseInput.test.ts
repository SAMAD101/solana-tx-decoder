import { describe, expect, test } from "vitest";
import { parseInput, toInput } from "../shared/parseInput";

const SIG = "2mpgTcStRXasDgZ2wcYKcZZu7wcxqQ8ACvLnTQ6fRLLQGYkmSak6ceu3y13z5NA3iWUxjkL4psThPzN8nzE7yRCe"; // 88 chars
const SIG87 = "5dtQqZivx2pw2Vd3y54Kynm5ixaehutDjWUf5FGjZzuCZxNqV9KL7x1iCemChCexNbaZbUhpuZT3Qwdj7RQA3mt"; // 87 chars

const ok = (input: string, cluster: string, signature = SIG) =>
  expect(parseInput(input)).toEqual({ ok: true, signature, cluster: cluster as never });
const bad = (input: string, match: RegExp) => {
  const r = parseInput(input);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(match);
};

describe("parseInput", () => {
  test("raw signatures, 87 and 88 chars, whitespace trimmed", () => {
    ok(SIG, "mainnet-beta");
    ok(`  ${SIG}\n`, "mainnet-beta");
    ok(SIG87, "mainnet-beta", SIG87);
  });

  test("solscan", () => {
    ok(`https://solscan.io/tx/${SIG}`, "mainnet-beta");
    ok(`https://solscan.io/tx/${SIG}?cluster=devnet`, "devnet");
    ok(`https://www.solscan.io/tx/${SIG}/`, "mainnet-beta");
    ok(`solscan.io/tx/${SIG}`, "mainnet-beta");
  });

  test("explorer.solana.com", () => {
    ok(`https://explorer.solana.com/tx/${SIG}`, "mainnet-beta");
    ok(`https://explorer.solana.com/tx/${SIG}?cluster=devnet`, "devnet");
    ok(`https://explorer.solana.com/tx/${SIG}?cluster=testnet`, "testnet");
  });

  test("solana.fm", () => {
    ok(`https://solana.fm/tx/${SIG}`, "mainnet-beta");
    ok(`https://solana.fm/tx/${SIG}?cluster=devnet-solana`, "devnet");
    ok(`https://solana.fm/tx/${SIG}?cluster=testnet-solana`, "testnet");
    ok(`https://solana.fm/tx/${SIG}?cluster=mainnet-alpha`, "mainnet-beta");
  });

  test("rejects bad input with a specific message", () => {
    bad("", /Paste/);
    bad("   ", /Paste/);
    bad(SIG.slice(0, 60), /87 or 88 characters; this one is 60/);
    bad(`${SIG}1`, /this one is 89/);
    bad(SIG.replace("2", "0"), /base58/);
    bad(SIG.replace("2", "l"), /base58/);
    bad(`${SIG.slice(0, 40)} ${SIG.slice(40)}`, /spaces/);
    bad(`https://etherscan.io/tx/${SIG}`, /Unsupported site "etherscan.io"/);
    bad(`https://solscan.io/account/${SIG}`, /not a transaction page/);
    bad(`https://solscan.io/tx/${SIG}?cluster=localnet`, /Unknown cluster "localnet"/);
  });

  test("toInput round-trips through parseInput", () => {
    for (const cluster of ["mainnet-beta", "devnet", "testnet"] as const) {
      expect(parseInput(toInput(SIG, cluster))).toEqual({ ok: true, signature: SIG, cluster });
    }
  });
});
