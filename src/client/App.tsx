import { useAgent } from "agents/react";
import { useState, type FormEvent } from "react";
import Markdown from "react-markdown";
import type { TxExplainerAgent } from "../agent";
import { parseInput, toInput } from "../shared/parseInput";
import type { State } from "../shared/types";
import {
  Accounts,
  BalanceChanges,
  Box,
  ErrorBox,
  Instructions,
  Logs,
  Overview,
  Progress,
  RecentList,
} from "./ui";

const STALE_MS = 120_000;
const RUNNING = new Set(["fetching", "decoding", "explaining"]);

function getSessionId(): string {
  try {
    let id = localStorage.getItem("session-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("session-id", id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // storage blocked: session lasts for this tab only
  }
}
const SESSION_ID = getSessionId();

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App() {
  const [connected, setConnected] = useState(false);
  const agent = useAgent<TxExplainerAgent, State>({
    agent: "TxExplainerAgent",
    name: SESSION_ID,
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false),
  });
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const current = agent.state?.current ?? null;
  const recent = agent.state?.recent ?? [];
  const running =
    !!current &&
    RUNNING.has(current.status) &&
    Date.now() - current.startedAt < STALE_MS;
  const decoded = current?.decoded;

  async function run(value: string) {
    const parsed = parseInput(value); // instant inline feedback; the agent validates again
    if (!parsed.ok) return setInputError(parsed.error);
    setInputError(null);
    setCallError(null);
    try {
      const res = await agent.stub.explain(value);
      if (!res.ok) setInputError(res.error);
    } catch (e) {
      setCallError(
        `Could not reach the agent (${message(e)}). It reconnects automatically; try again in a moment.`,
      );
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault(); // Enter in the input submits the form
    if (!running) void run(input);
  };

  return (
    <main>
      <header className="box">
        <h1>solana tx explainer</h1>
        <p>
          Paste a Solana transaction link or signature. Get a decoded breakdown
          and a plain-English explanation.
        </p>
      </header>

      <form className="box input-box" onSubmit={onSubmit} noValidate>
        <label htmlFor="tx-input" className="label">
          transaction
        </label>
        <div className="input-row">
          <input
            id="tx-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (inputError) setInputError(null);
            }}
            placeholder="signature, or a solscan.io / explorer.solana.com / solana.fm link"
            spellCheck={false}
            autoComplete="off"
            disabled={running}
            aria-invalid={!!inputError}
            aria-describedby={inputError ? "tx-input-error" : undefined}
          />
          <button type="submit" disabled={running || !connected}>
            {running ? "Decoding…" : "Decode"}
          </button>
        </div>
        {inputError && (
          <p id="tx-input-error" className="inline-error" role="alert">
            {inputError}
          </p>
        )}
        {!connected && <p className="muted">connecting to agent…</p>}
      </form>

      {current && <Progress current={current} />}
      {callError && <ErrorBox message={callError} />}
      {current?.error && <ErrorBox message={current.error} />}

      {current && current.status !== "error" && (
        <Box title="AI Explanation" className="explanation">
          {current.explanation ? (
            // react-markdown renders no raw HTML unless rehype-raw is added, and it sanitizes link URLs.
            <Markdown>{current.explanation}</Markdown>
          ) : current.status === "done" ? (
            <p className="muted">
              No explanation available. The decoded transaction is below.
            </p>
          ) : (
            <p className="muted">
              {current.status === "explaining"
                ? "Llama 3.3 is writing the explanation…"
                : "Waiting for the decoded transaction…"}
            </p>
          )}
        </Box>
      )}

      {decoded && (
        <>
          <Overview d={decoded} />
          <BalanceChanges d={decoded} />
          <Instructions d={decoded} />
          <Accounts d={decoded} />
          <Logs d={decoded} />
        </>
      )}

      {recent.length > 0 && (
        <RecentList
          recent={recent}
          disabled={running}
          onPick={(r) => {
            const value = toInput(r.signature, r.cluster);
            setInput(value);
            void run(value);
          }}
        />
      )}
    </main>
  );
}
