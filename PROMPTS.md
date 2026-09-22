# Prompts

Every prompt given for this project, in order.

---

## 1

> in this project directory which is empty rn: # Task: Build "cf*ai_solana_tx_explainer" — a Solana transaction decoder + AI explainer on Cloudflare. \_This detailed prompt below was generated in a separate claude chat.*
>
> ## Before writing any code
>
> 1. Read the current docs, because these APIs change often. Do not guess signatures:
>    - Agents SDK: https://developers.cloudflare.com/agents/
>    - Workflows: https://developers.cloudflare.com/workflows/
>    - Workers AI: https://developers.cloudflare.com/workers-ai/
>    - Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
> 2. Confirm the exact Workers AI model ID for Llama 3.3 (expected: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
> 3. Show me a short plan (file tree + data flow) and wait for my approval before implementing.
>
> ## What the app does
>
> - User pastes a Solana transaction URL or raw signature into a single input box.
> - App fetches the transaction from Solana RPC, decodes it, and renders a structured breakdown.
> - Llama 3.3 on Workers AI writes a plain-English explanation of what the transaction did.
> - No database. No auth. No wallet connection.
>
> ## Input parsing
>
> Accept all of these and extract the signature + cluster:
>
> - `https://solscan.io/tx/<sig>` (with optional `?cluster=devnet`)
> - `https://explorer.solana.com/tx/<sig>` (with optional `?cluster=devnet|testnet`)
> - `https://solana.fm/tx/<sig>` (with optional `?cluster=devnet-solana|...`)
> - A raw base58 signature
>   Validate: signature is base58 and 87–88 chars. Default cluster is mainnet-beta. Show a clear inline error for invalid input.
>
> ## Architecture (all on Cloudflare, one Worker)
>
> - **Frontend:** React + Vite + TypeScript, served as Worker static assets via `@cloudflare/vite-plugin`.
> - **Agent:** `TxExplainerAgent` (extends `Agent` from the `agents` package), one instance per browser session (random session ID stored in localStorage).
>   - Frontend connects with `useAgent` from `agents/react` so state syncs over WebSocket.
>   - Exposes a callable method `explain(input: string)` that parses input and starts the Workflow.
>   - Agent state (no database, just `this.setState`):
>
> ```ts
> type State = {
>   current: {
>     signature: string;
>     cluster: string;
>     status:
>       | "idle"
>       | "fetching"
>       | "decoding"
>       | "explaining"
>       | "done"
>       | "error";
>     decoded?: DecodedTx;
>     explanation?: string;
>     error?: string;
>   } | null;
>   recent: {
>     signature: string;
>     cluster: string;
>     summary: string;
>     at: number;
>   }[]; // max 10
> };
> ```
>
> - **Workflow:** `ExplainTxWorkflow` (extends `WorkflowEntrypoint`) with durable steps:
>   1. `fetch-tx` — call RPC `getTransaction` with `{ encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }`. Retry with backoff (3 attempts). If null, fail with "Transaction not found (check cluster)".
>   2. `decode` — pure function `decodeTransaction(raw) -> DecodedTx` (see below).
>   3. `explain` — call Workers AI with a compact summary (NOT the raw JSON).
>   4. `report` — push progress and final results back to the agent instance (use the documented way to get an agent stub from a Workflow, e.g. `getAgentByName`), updating `status` after each step so the UI shows live progress.
> - **Bindings in wrangler config:** `AI`, the agent Durable Object (with migration), the Workflow, static assets.
> - **Env var:** `SOLANA_RPC_URL` (secret), falling back to public RPC endpoints per cluster if unset. Document that public RPC is rate-limited.
>
> ## Decoding (`DecodedTx`)
>
> Build these from the jsonParsed response:
>
> - Overview: signature, status (success/failed + error), slot, block time (ISO + relative), fee in SOL, compute units consumed, version (legacy/v0).
> - Signers and fee payer.
> - Accounts table: address, signer?, writable?, source (transaction / lookup table).
> - SOL balance changes: per account, pre → post, delta. Hide zero-delta accounts.
> - Token balance changes: from `preTokenBalances`/`postTokenBalances` — owner, mint, delta (UI amount).
> - Instructions: ordered list. For each: program name (via known-program map, else shortened address), instruction type, and parsed `info` if present; otherwise raw base58 data (truncated) and account list.
> - Inner instructions nested under their parent instruction index.
> - Logs: full list, collapsible.
>
> Known-program map (put in `src/shared/programs.ts`, verify each ID, add more you are certain of, never invent IDs):
>
> - System Program `11111111111111111111111111111111`
> - SPL Token `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
> - Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`
> - Associated Token Account `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`
> - Compute Budget `ComputeBudget111111111111111111111111111111`
> - Memo `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`
> - Jupiter v6 `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
>
> Put decoding in pure, framework-free functions and add unit tests (Vitest) using 2–3 saved real transaction JSON fixtures (a SOL transfer, a token transfer, a swap, and a failed tx if possible).
>
> ## AI explanation
>
> - Build a compact text summary for the LLM: overview, balance changes, instruction list with program names and parsed types, first ~30 log lines. Keep it under ~6k tokens; truncate safely.
> - System prompt rules:
>   - Explain what happened in plain English for a developer audience: start with a one-sentence summary, then a short step-by-step breakdown, then notable details (fees, failures and likely cause from logs, unusual patterns).
>   - Use ONLY the provided data. If a program is unknown, say so; never guess protocol names from addresses.
>   - For failed transactions, point to the specific log line / error that explains the failure.
>   - Output Markdown, max ~250 words.
> - Render the Markdown safely on the frontend (e.g. `react-markdown`, no raw HTML).
>
> ## UI: minimal, boxy
>
> - Monospace font throughout (system mono stack), black/white/gray only, one accent color for status.
> - Every section is a rectangular box: 1px solid border, no border-radius, no shadows, no gradients.
> - Layout, top to bottom:
>   1. Header: app name + one-line description.
>   2. Input box + "Decode" button (Enter also submits). Disabled while running.
>   3. Progress strip: `FETCH → DECODE → EXPLAIN` with the active step highlighted.
>   4. "AI Explanation" box.
>   5. "Overview" box as a 2-column key/value grid.
>   6. "Balance Changes" box (SOL + tokens tables).
>   7. "Instructions" box with numbered instructions and indented inner instructions.
>   8. "Accounts" and "Logs" boxes, collapsible, collapsed by default.
>   9. "Recent" box listing up to 10 past lookups from agent state; clicking one re-runs it.
> - Addresses shortened as `AbCd…WxYz` with a copy button and a link to Solscan for the right cluster.
> - Tables scroll horizontally inside their box on narrow screens; page never scrolls sideways.
> - Respect `prefers-color-scheme` (invert to white-on-black).
> - Plain CSS or CSS modules. No UI component library.
>
> ## Error handling
>
> - Invalid input, tx not found, RPC rate limit, AI failure: each shows a specific message in a bordered error box.
> - If AI fails, still show the decoded transaction.
>
> ## Project hygiene
>
> - TypeScript strict mode. Shared types in `src/shared/`.
> - Scripts: `npm run dev` (local dev with Workers AI remote binding), `npm test`, `npm run deploy`.
> - `README.md` containing: what it does, a screenshot placeholder, architecture diagram (Mermaid), a section explicitly mapping each assignment requirement (LLM, Workflow/coordination, user input, memory/state) to the code, local setup steps, deploy steps, and the live URL placeholder.
> - `PROMPTS.md`: record this prompt and every later prompt I give you, in order.
> - Initialize git with sensible commits per milestone.
>
> ## Milestones (stop and let me test after each)
>
> 1. Scaffold + deploy a hello-world Worker serving the Vite app.
> 2. Input parsing + RPC fetch + decoding + UI rendering (no AI yet), with tests.
> 3. Agent + Workflow + live progress via agent state.
> 4. Workers AI explanation.
> 5. Recent lookups, polish, README, PROMPTS.md.

---

## 2

> now start building the solana transaction decoder project

---

## 3

> https://cf-ai-solana-tx-explainer.asamadans.workers.dev

---

## 4

> Complete the remaining work, do not commit any changes, I review the changes before committing
> myself

---

## 5

> add more popular tokens to KNOWN_MINTS like of MET, JUP, wrapped BTC, jito's tokens like jitoSOL,
> Raydium's tokens like RAY, PYTH, and other tokens.

---

## 6

> make the explanation to be 500 words max.

---

## 7

> add dflow addresses

---

## 8

> add pumpfun AMM addres pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA

---

## 9

> add Pump fees Program pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ

---

## 10

> for known programs, in the instructions tree, also show the program address in the standard shortened version with the copy button as it is done for unknown programs. Known programs should be displayed with address and the copy button.

---

## 11

> in this AI explanation:
> The fee payer 7uj9…ZkfZ sent 0.000005333 SOL and 1123.031704 of the EPjF…Dt1v token, and received no tokens or SOL in return, only paying the fee.
>
> - the amount of USDC is shown in the summary and later in the explanation, that address is of USDC and is known in @src/shared/programs.ts , yet in the explanation the address is only shown, always replace the adress in explanation with the name of the program/token if known.

---

## 12

> also add squads address

---

## 13

> update tests
