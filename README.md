# cf_ai_solana_tx_explainer

Paste a Solana transaction link or signature. The app fetches it from Solana RPC, decodes it into a
structured breakdown (overview, SOL and token balance changes, instructions with nested inner
instructions, accounts, logs), and has Llama 3.3 on Workers AI explain what happened in plain
English.

**Live:** https://cf-ai-solana-tx-explainer.asamadans.workers.dev

**Sample transaction hash to try with:**

> 2UCQHsXnkn8iZDfhxdN5U7zrdonDjnoNX4g6NKrCFFtUWEW71kqBNjoNP27Kzpv6ihEpdfQLyRZ8iXSEe18biBUW

1. The browser generates a random session ID (kept in `localStorage`) and connects to its own
   `TxExplainerAgent` instance with `useAgent`. Agent state syncs over the WebSocket.
2. Decode calls `agent.stub.explain(input)`. The agent re-validates the input, sets
   `status: "fetching"`, and starts an `ExplainTxWorkflow` instance.
3. Each workflow step is durable. After each one the workflow gets the agent stub with
   `getAgentByName` and calls `report(runId, patch)`. The agent `setState`s, and every connected tab
   re-renders: `FETCH → DECODE → EXPLAIN` progresses live.
4. A finished lookup is pushed to `recent` (max 10). Clicking one re-runs it.

## Code components

| Component                   | Where                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LLM**                     | Llama 3.3 (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) via the `AI` binding in [`src/ai.ts`](src/ai.ts). The model gets a compact, size-capped summary ([`src/shared/summary.ts`](src/shared/summary.ts)), never raw JSON.                                                                                                                |
| **Workflow / coordination** | [`src/workflow.ts`](src/workflow.ts): `ExplainTxWorkflow extends WorkflowEntrypoint` with durable steps `fetch-tx` (3 attempts, exponential backoff), `decode`, `explain` (2 attempts), and `report*` steps that call back into the agent with `getAgentByName`. The agent ([`src/agent.ts`](src/agent.ts)) starts it and owns the state. |
| **User input**              | One input box ([`src/client/App.tsx`](src/client/App.tsx)) accepting solscan.io, explorer.solana.com and solana.fm links (with their cluster params) or a raw signature. Parsing and validation in [`src/shared/parseInput.ts`](src/shared/parseInput.ts), run on the client for instant feedback and again in the agent.                 |
| **Memory / state**          | `TxExplainerAgent` state (`this.setState`, SQLite-backed Durable Object): the in-flight lookup with live status, and the last 10 lookups. Synced to the browser over WebSocket.                                                                                                                                                           |

## Local setup

Requires Node.js 20+ (npm) and a Cloudflare account.

```bash
npm install
npx wrangler login                  # one time; also authorizes the remote AI binding in dev
cp .env.example .env                # then set SOLANA_RPC_URL
npm run dev                         # http://localhost:5173
```

```bash
npm test
npm run check
```

### Solana RPC: a private URL is required

| Variable                 | Cluster      |
| ------------------------ | ------------ |
| `SOLANA_RPC_URL`         | mainnet-beta |
| `SOLANA_RPC_URL_DEVNET`  | devnet       |
| `SOLANA_RPC_URL_TESTNET` | testnet      |

## Deploy

```bash
npx wrangler secret put SOLANA_RPC_URL
npm run deploy
```

## Tests

`src/test/fixtures/` holds five real mainnet `getTransaction` responses, fetched with the exact
parameters the app uses:

| Fixture               | Covers                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `sol-transfer.json`   | legacy tx, parsed System transfer, zero-delta account hidden                                                                      |
| `token-transfer.json` | `transferChecked`, exact token deltas (the RPC's `uiAmount` float is off by 1 in the last digit), a freshly created token account |
| `jupiter-swap.json`   | v0 tx, 13 lookup-table accounts, 8 inner instructions at two CPI depths, unknown programs, a round-trip (arbitrage) route         |
| `failed.json`         | v1 tx, `InvalidInstructionData`, failure log line extraction                                                                      |
| `v1.json`             | v1 tx, custom program error `5457 (0x1551)`                                                                                       |
