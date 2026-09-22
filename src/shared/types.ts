export type Cluster = "mainnet-beta" | "devnet" | "testnet";

/** What the RPC's jsonParsed output is made of. Also satisfies Workflows' step Serializable constraint. */
export type Json = string | number | boolean | null | JsonArray | JsonObject;
// Interfaces, not an inline recursive alias: TS resolves them lazily, which keeps
// Serializable<T> and DO stub types from hitting TS2589.
export interface JsonObject { [key: string]: Json }
export interface JsonArray extends Array<Json> {}

export type Status = "idle" | "fetching" | "decoding" | "explaining" | "done" | "error";

export type AccountRow = {
  address: string;
  signer: boolean;
  writable: boolean;
  source: "transaction" | "lookupTable";
};

/** Lamports as JSON numbers: exact below 2^53 (~9M SOL), which is all the RPC's own JSON gives us. */
export type SolChange = { address: string; pre: number; post: number; delta: number };

/** Amounts are exact decimal strings computed from raw integer amounts, never from uiAmount floats. */
export type TokenChange = {
  account: string;
  owner: string | null;
  mint: string;
  decimals: number;
  pre: string;
  post: string;
  delta: string;
};

export type DecodedIx = {
  /** 1-based, e.g. "3" for a top-level instruction or "3.2" for its 2nd inner instruction. */
  index: string;
  programId: string;
  program: string;
  known: boolean;
  type: string | null;
  info?: Json;
  /** base58 instruction data, only when the RPC could not parse it. */
  data?: string;
  accounts?: string[];
  /** 0 for top-level; inner instructions use stackHeight - 1 so CPIs of CPIs indent further. */
  depth: number;
  inner: DecodedIx[];
};

export type DecodedTx = {
  signature: string;
  cluster: Cluster;
  success: boolean;
  error: string | null;
  /** Log lines that mention the failure, so the UI and the LLM can point at them. */
  errorLogs: string[];
  slot: number;
  blockTime: number | null;
  blockTimeIso: string | null;
  feeLamports: number;
  computeUnits: number | null;
  version: "legacy" | `v${number}`;
  feePayer: string;
  signers: string[];
  accounts: AccountRow[];
  solChanges: SolChange[];
  tokenChanges: TokenChange[];
  instructions: DecodedIx[];
  logs: string[];
};

export type Current = {
  /** Workflow instance id. Reports from any other run are ignored. */
  runId: string;
  startedAt: number;
  signature: string;
  cluster: Cluster;
  status: Status;
  decoded?: DecodedTx;
  explanation?: string;
  error?: string;
};

export type Recent = { signature: string; cluster: Cluster; summary: string; at: number };

export type State = {
  current: Current | null;
  recent: Recent[];
};

export type ExplainParams = { sessionId: string; runId: string; signature: string; cluster: Cluster };
