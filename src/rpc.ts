import { NonRetryableError } from "cloudflare:workflows";
import type { RawTx } from "./shared/decode";
import type { Cluster } from "./shared/types";

export const PUBLIC_RPC: Record<Cluster, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

export const RPC_ENV: Record<Cluster, string> = {
  "mainnet-beta": "SOLANA_RPC_URL",
  devnet: "SOLANA_RPC_URL_DEVNET",
  testnet: "SOLANA_RPC_URL_TESTNET",
};

export const NOT_FOUND = "Transaction not found (check cluster)";

export async function fetchTransaction(
  signature: string,
  cluster: Cluster,
  override?: string,
): Promise<RawTx> {
  const url = override || PUBLIC_RPC[cluster];
  const source = override ? RPC_ENV[cluster] : "the public endpoint";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          {
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 1,
            commitment: "confirmed",
          },
        ],
      }),
    });
  } catch (e) {
    throw new Error(
      `Could not reach Solana RPC via ${source} (${e instanceof Error ? e.message : String(e)}).`,
    );
  }

  if (res.status === 403 || res.status === 401) {
    throw new NonRetryableError(
      override
        ? `Solana RPC via ${source} refused the request (HTTP ${res.status}). Check the URL and its API key.`
        : `Solana's public ${cluster} RPC blocks requests from Cloudflare Workers (HTTP 403). Set ${RPC_ENV[cluster]} to a private RPC URL (Helius, QuickNode, Triton, ...).`,
    );
  }
  if (res.status === 429) {
    throw new Error(
      `Solana RPC rate limit hit on ${source}. Wait a minute and retry${override ? "" : `, or set ${RPC_ENV[cluster]} to a private RPC`}.`,
    );
  }
  if (!res.ok)
    throw new Error(`Solana RPC via ${source} returned HTTP ${res.status}.`);

  const body = (await res.json()) as {
    result?: RawTx | null;
    error?: { code: number; message: string };
  };
  if (body.error) {
    if (
      body.error.code === 429 ||
      /too many requests|rate limit/i.test(body.error.message)
    ) {
      throw new Error(
        `Solana RPC rate limit hit on ${source}. Wait a minute and retry.`,
      );
    }
    // -32602 invalid params etc. will not change on retry.
    throw new NonRetryableError(
      `Solana RPC error ${body.error.code}: ${body.error.message}`,
    );
  }
  if (!body.result) throw new Error(`${NOT_FOUND}. Looked on ${cluster}.`);
  return body.result;
}
