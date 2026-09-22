import { formatUnits, shortAddr } from "./format";
import { KNOWN_PROGRAMS } from "./programs";
import type {
  AccountRow,
  Cluster,
  DecodedIx,
  DecodedTx,
  Json,
  SolChange,
  TokenChange,
} from "./types";

// Parts of a jsonParsed getTransaction result that we read.
type RawIx = {
  programId: string;
  program?: string;
  parsed?: { type?: string; info?: Json } | string;
  accounts?: string[];
  data?: string;
  stackHeight?: number | null;
};

type RawTokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
};

export type RawTx = {
  slot: number;
  blockTime?: number | null;
  version?: "legacy" | number;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: {
        pubkey: string;
        signer: boolean;
        writable: boolean;
        source?: string;
      }[];
      instructions: RawIx[];
    };
  };
  meta: {
    err: Json;
    fee: number;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: RawTokenBalance[] | null;
    postTokenBalances?: RawTokenBalance[] | null;
    innerInstructions?: { index: number; instructions: RawIx[] }[] | null;
    logMessages?: string[] | null;
    computeUnitsConsumed?: number;
  } | null;
};

export function programName(
  programId: string,
  rpcName?: string,
): { program: string; known: boolean } {
  const known = KNOWN_PROGRAMS[programId];
  if (known) return { program: known, known: true };
  // The RPC names programs it has a parser for (e.g. "spl-token"); trust that over nothing.
  if (rpcName && rpcName !== "unknown")
    return { program: rpcName, known: true };
  return { program: shortAddr(programId), known: false };
}

function decodeIx(ix: RawIx, index: string, depth: number): DecodedIx {
  const { program, known } = programName(ix.programId, ix.program);
  const base = {
    index,
    programId: ix.programId,
    program,
    known,
    depth,
    inner: [],
  };
  if (typeof ix.parsed === "string")
    return { ...base, type: "memo", info: ix.parsed }; // spl-memo parses to a bare string
  if (ix.parsed)
    return { ...base, type: ix.parsed.type ?? null, info: ix.parsed.info };
  return {
    ...base,
    type: null,
    data: ix.data ?? "",
    accounts: ix.accounts ?? [],
  };
}

export function formatTxError(err: unknown): string | null {
  if (err == null) return null;
  if (typeof err === "string") return err;
  if (typeof err === "object" && "InstructionError" in err) {
    const [idx, detail] = (err as { InstructionError: [number, unknown] })
      .InstructionError;
    let what: string;
    if (typeof detail === "string") what = detail;
    else if (detail && typeof detail === "object" && "Custom" in detail) {
      const code = Number((detail as { Custom: number }).Custom);
      what = `custom program error ${code} (0x${code.toString(16)})`;
    } else what = JSON.stringify(detail);
    return `Instruction #${idx + 1} failed: ${what}`;
  }
  return JSON.stringify(err);
}

const ERROR_LOG = /\b(failed|error|panicked|insufficient|exceeded|invalid)\b/i;

export function decodeTransaction(raw: RawTx, cluster: Cluster): DecodedTx {
  const meta = raw.meta;
  if (!meta)
    throw new Error(
      "Transaction has no status metadata (the RPC node may have pruned it).",
    );

  const keys = raw.transaction.message.accountKeys;
  const accounts: AccountRow[] = keys.map((k) => ({
    address: k.pubkey,
    signer: k.signer,
    writable: k.writable,
    source: k.source === "lookupTable" ? "lookupTable" : "transaction",
  }));

  const solChanges: SolChange[] = keys
    .map((k, i) => {
      const pre = meta.preBalances[i] ?? 0;
      const post = meta.postBalances[i] ?? 0;
      return { address: k.pubkey, pre, post, delta: post - pre };
    })
    .filter((c) => c.delta !== 0);

  // Pair balances by account index: a token account can appear only in pre (closed) or only in post (created).
  const pre = new Map(
    (meta.preTokenBalances ?? []).map((b) => [b.accountIndex, b]),
  );
  const post = new Map(
    (meta.postTokenBalances ?? []).map((b) => [b.accountIndex, b]),
  );
  const tokenChanges: TokenChange[] = [
    ...new Set([...pre.keys(), ...post.keys()]),
  ]
    .sort((a, b) => a - b)
    .flatMap((i) => {
      const a = pre.get(i);
      const b = post.get(i);
      const ref = (b ?? a)!;
      const decimals = ref.uiTokenAmount.decimals;
      const preAmt = BigInt(a?.uiTokenAmount.amount ?? "0");
      const postAmt = BigInt(b?.uiTokenAmount.amount ?? "0");
      if (preAmt === postAmt) return [];
      return [
        {
          account: keys[i]?.pubkey ?? `#${i}`,
          owner: b?.owner ?? a?.owner ?? null,
          mint: ref.mint,
          decimals,
          pre: formatUnits(preAmt, decimals),
          post: formatUnits(postAmt, decimals),
          delta: formatUnits(postAmt - preAmt, decimals),
        },
      ];
    });

  const instructions = raw.transaction.message.instructions.map((ix, i) =>
    decodeIx(ix, String(i + 1), 0),
  );
  for (const group of meta.innerInstructions ?? []) {
    const parent = instructions[group.index];
    if (!parent) continue;
    parent.inner = group.instructions.map((ix, j) =>
      decodeIx(
        ix,
        `${group.index + 1}.${j + 1}`,
        Math.max(1, (ix.stackHeight ?? 2) - 1),
      ),
    );
  }

  const logs = meta.logMessages ?? [];
  const error = formatTxError(meta.err);

  return {
    signature: raw.transaction.signatures[0]!,
    cluster,
    success: meta.err == null,
    error,
    errorLogs: error ? logs.filter((l) => ERROR_LOG.test(l)) : [],
    slot: raw.slot,
    blockTime: raw.blockTime ?? null,
    blockTimeIso: raw.blockTime
      ? new Date(raw.blockTime * 1000).toISOString()
      : null,
    feeLamports: meta.fee,
    computeUnits: meta.computeUnitsConsumed ?? null,
    version:
      raw.version === undefined || raw.version === "legacy"
        ? "legacy"
        : `v${raw.version}`,
    feePayer: keys[0]!.pubkey,
    signers: keys.filter((k) => k.signer).map((k) => k.pubkey),
    accounts,
    solChanges,
    tokenChanges,
    instructions,
    logs,
  };
}
