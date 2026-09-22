import { describe, expect, test } from "vitest";
import { decodeTransaction, formatTxError, type RawTx } from "../shared/decode";
import { formatUnits, lamportsToSol, relativeTime } from "../shared/format";
import { buildSummary, nameKnownAddresses, SUMMARY_CHAR_BUDGET } from "../shared/summary";
import failed from "./fixtures/failed.json";
import swap from "./fixtures/jupiter-swap.json";
import solTransfer from "./fixtures/sol-transfer.json";
import tokenTransfer from "./fixtures/token-transfer.json";
import v1 from "./fixtures/v1.json";

const decode = (raw: unknown) => decodeTransaction(raw as RawTx, "mainnet-beta");

describe("SOL transfer (legacy)", () => {
  const d = decode(solTransfer);

  test("overview", () => {
    expect(d.success).toBe(true);
    expect(d.error).toBeNull();
    expect(d.version).toBe("legacy");
    expect(d.slot).toBe(449292901);
    expect(d.blockTimeIso).toBe(new Date(1790057223 * 1000).toISOString());
    expect(d.feeLamports).toBe(5000);
    expect(d.computeUnits).toBe(150);
    expect(d.feePayer).toBe("WnKpahtNnvoj2QkY1usTpvjzJEJ4jWiCtyrdRaqFBYq");
    expect(d.signers).toEqual(["WnKpahtNnvoj2QkY1usTpvjzJEJ4jWiCtyrdRaqFBYq"]);
  });

  test("SOL changes hide zero-delta accounts; sender pays amount + fee", () => {
    expect(d.solChanges.map((c) => c.delta)).toEqual([-(15704404 + 5000), 15704404]); // System Program row (0 delta) hidden
    expect(lamportsToSol(d.solChanges[1]!.delta)).toBe("0.015704404");
  });

  test("parsed System transfer", () => {
    expect(d.instructions).toHaveLength(1);
    const ix = d.instructions[0]!;
    expect(ix).toMatchObject({ index: "1", program: "System Program", known: true, type: "transfer", depth: 0, inner: [] });
    expect(ix.info).toMatchObject({ lamports: 15704404 });
    expect(d.tokenChanges).toEqual([]);
  });
});

describe("token transfer (legacy)", () => {
  const d = decode(tokenTransfer);

  test("token delta is exact (from raw amount, not the uiAmount float)", () => {
    expect(d.tokenChanges).toHaveLength(2);
    const [sender, receiver] = d.tokenChanges;
    // uiAmount in the fixture is 130826785413.64368; the exact raw amount ends in ...64369
    expect(sender).toMatchObject({ pre: "130826785413.64369", post: "129930413529.64369", delta: "-896371884", decimals: 5 });
    // receiver token account had pre uiAmount null (a fresh account): treated as 0
    expect(receiver).toMatchObject({ pre: "0", post: "896371884", delta: "896371884", owner: "eoVmtV3DKq7ZWswhNzDPRdYXR7GXVjD8zZrbA1rPwDe" });
  });

  test("unparsed Compute Budget instructions keep raw data", () => {
    expect(d.instructions[0]).toMatchObject({ program: "SPL Token", type: "transferChecked" });
    for (const ix of d.instructions.slice(1)) {
      expect(ix).toMatchObject({ program: "Compute Budget", known: true, type: null });
      expect(typeof ix.data).toBe("string");
      expect(ix.info).toBeUndefined();
    }
  });
});

describe("Jupiter swap (v0, lookup tables, inner instructions)", () => {
  const d = decode(swap);

  test("version and account sources", () => {
    expect(d.version).toBe("v0");
    expect(d.accounts).toHaveLength(23);
    expect(d.accounts.filter((a) => a.source === "lookupTable")).toHaveLength(13);
    expect(d.accounts.filter((a) => a.source === "lookupTable").every((a) => !a.signer)).toBe(true);
  });

  test("inner instructions nest under their parent with 1-based indices", () => {
    const jup = d.instructions[2]!;
    expect(jup).toMatchObject({ index: "3", program: "Jupiter v6", known: true, type: null });
    expect(jup.inner).toHaveLength(8);
    expect(jup.inner.map((i) => i.index)).toEqual(["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"]);
    // stackHeight 3 (a CPI inside a CPI) indents one level deeper than stackHeight 2
    expect(jup.inner[0]!.depth).toBe(1);
    expect(jup.inner[1]).toMatchObject({ program: "SPL Token", type: "transfer", depth: 2 });
    // programs outside the verified map stay unknown and are shown by short address
    expect(jup.inner[0]).toMatchObject({ known: false, program: expect.stringMatching(/^BiSo….{4}$/) });
    for (const other of d.instructions.filter((_, i) => i !== 2)) expect(other.inner).toEqual([]);
  });
});

describe("failed transactions (v1)", () => {
  test("InstructionError with a named error", () => {
    const d = decode(failed);
    expect(d.version).toBe("v1");
    expect(d.success).toBe(false);
    expect(d.error).toBe("Instruction #1 failed: InvalidInstructionData");
    expect(d.errorLogs).toEqual(["Program EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih failed: invalid instruction data"]);
    expect(d.instructions[0]).toMatchObject({ known: false, type: null });
  });

  test("InstructionError with a custom program error code", () => {
    const d = decode(v1);
    expect(d.error).toBe("Instruction #1 failed: custom program error 5457 (0x1551)");
    expect(d.errorLogs.at(-1)).toContain("custom program error: 0x1551");
  });

  test("other error shapes", () => {
    expect(formatTxError(null)).toBeNull();
    expect(formatTxError("AccountInUse")).toBe("AccountInUse");
    expect(formatTxError({ InsufficientFundsForRent: { account_index: 2 } })).toBe('{"InsufficientFundsForRent":{"account_index":2}}');
  });

  test("a tx without meta is rejected with a clear message", () => {
    expect(() => decode({ ...solTransfer, meta: null })).toThrow(/no status metadata/);
  });
});

describe("LLM summary", () => {
  test("carries the facts the prompt relies on", () => {
    const s = buildSummary(decode(failed));
    expect(s).toContain("status: FAILED. Instruction #1 failed: InvalidInstructionData");
    expect(s).toContain("## Log lines that mention the failure");
    expect(s).toContain("UNKNOWN program (Etrn…jWih)");
    expect(buildSummary(decode(solTransfer))).toContain("15704404 lamports (0.015704404 SOL)");
    // known mints go in by name only: no address for the model to echo back
    const swapSummary = buildSummary(decode(swap));
    expect(swapSummary).toContain("mint Wrapped SOL:");
    expect(swapSummary).toContain("mint USDC:");
    expect(swapSummary).not.toContain("EPjF…Dt1v");
  });

  const section = (s: string, heading: string) => s.split(`## ${heading}`)[1]!.split("\n## ")[0]!;

  test("fee payer net changes: the arb nets a tiny wSOL gain; the sender loses the tokens it sent", () => {
    const net = section(buildSummary(decode(swap)), "Fee payer (ExYD…iDgo) net changes");
    expect(net).toContain("SOL: sent 0.00000763 SOL net, including the 0.00000763 SOL fee");
    expect(net).toContain("token: received 0.000075032 of Wrapped SOL");
    expect(net).not.toContain("USDC"); // USDC only moved between other owners' accounts
    expect(buildSummary(decode(tokenTransfer))).toContain("token: sent 896371884 of BONK");
    // a mint outside KNOWN_MINTS is labelled unknown, never guessed
    const unknownMint = decode(tokenTransfer);
    unknownMint.tokenChanges = unknownMint.tokenChanges.map((t) => ({ ...t, mint: "11111111111111111111111111111112" }));
    expect(buildSummary(unknownMint)).toContain("(unknown token)");
    expect(buildSummary(decode(solTransfer))).toContain("no token balance changes owned by the fee payer");
  });

  test("nameKnownAddresses rewrites known addresses in model output, and only those", () => {
    // the exact sentence from a real explanation
    expect(
      nameKnownAddresses("The fee payer 7uj9…ZkfZ sent 0.000005333 SOL and 1123.031704 of the EPjF…Dt1v token."),
    ).toBe("The fee payer 7uj9…ZkfZ sent 0.000005333 SOL and 1123.031704 of the USDC token.");
    // no doubled names when the model pairs the name with the address
    expect(nameKnownAddresses("received USDC (EPjF…Dt1v)")).toBe("received USDC");
    expect(nameKnownAddresses("via EPjF…Dt1v (USDC)")).toBe("via USDC");
    // full addresses, programs, and names containing parentheses
    expect(nameKnownAddresses("Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke")).toBe("Program SPL Token invoke");
    expect(nameKnownAddresses("routed through JUP6…TaV4")).toBe("routed through Jupiter v6");
    expect(nameKnownAddresses("bought JUPy…DvCN")).toBe("bought JUP (Jupiter)");
    expect(nameKnownAddresses("bought JUP (Jupiter) (JUPy…DvCN)")).toBe("bought JUP (Jupiter)");
    // unknown addresses are untouched
    expect(nameKnownAddresses("an unknown program (BiSo…Uypi)")).toBe("an unknown program (BiSo…Uypi)");
  });

  test("round-trip flag is computed, and only fires for the arb", () => {
    expect(buildSummary(decode(swap))).toContain("pattern: ROUND TRIP");
    for (const fx of [solTransfer, tokenTransfer, failed, v1]) expect(buildSummary(decode(fx))).not.toContain("ROUND TRIP");
  });

  test("log lines name verified programs instead of raw IDs", () => {
    const logs = section(buildSummary(decode(tokenTransfer)), "Program logs");
    expect(logs).toContain("Program SPL Token invoke [1]");
    expect(logs).not.toContain("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    expect(section(buildSummary(decode(failed)), "Log lines that mention the failure")).toContain("Program Etrn…jWih failed: invalid instruction data");
  });

  test("unparsed instructions say so in plain words", () => {
    expect(buildSummary(decode(swap))).toContain("#3 Jupiter v6 (not parsed by RPC) (raw: 38 accounts, 77 base58 characters of instruction data)");
  });

  test("stays under budget and marks truncation on a huge tx", () => {
    const d = decode(swap);
    const huge = { ...d, logs: Array.from({ length: 5000 }, (_, i) => `Program log: line ${i} ${"x".repeat(200)}`) };
    huge.instructions = Array.from({ length: 400 }, () => d.instructions[2]!);
    const s = buildSummary(huge);
    expect(s.length).toBeLessThanOrEqual(SUMMARY_CHAR_BUDGET);
    expect(s).toMatch(/… \d+ more omitted/);
    expect(s).toContain("## Overview"); // highest-priority section survives
  });
});

describe("format", () => {
  test("formatUnits is exact", () => {
    expect(formatUnits(1n, 9)).toBe("0.000000001");
    expect(formatUnits(-1500000000n, 9)).toBe("-1.5");
    expect(formatUnits(12993041352964369n, 5)).toBe("129930413529.64369");
    expect(formatUnits(42n, 0)).toBe("42");
  });

  test("relativeTime", () => {
    const now = 1_000_000_000_000;
    expect(relativeTime(now / 1000 - 30, now)).toBe("just now");
    expect(relativeTime(now / 1000 - 90, now)).toBe("1 minute ago");
    expect(relativeTime(now / 1000 - 3 * 86400, now)).toBe("3 days ago");
  });
});
