import { Agent, callable, type Connection } from "agents";
import { parseInput } from "./shared/parseInput";
import type { Current, DecodedTx, Recent, State } from "./shared/types";

const MAX_RECENT = 10;

export type ReportPatch = Partial<
  Pick<Current, "status" | "decoded" | "explanation" | "error">
>;

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

function recentSummary(decoded: DecodedTx, explanation?: string): string {
  const sentence = explanation
    ?.replace(/[*_`#>]/g, "")
    .split(/(?<=[.!?])\s/)[0]
    ?.trim();
  if (sentence)
    return sentence.length > 120 ? `${sentence.slice(0, 119)}…` : sentence;
  const programs = [
    ...new Set(
      decoded.instructions
        .filter((i) => i.program !== "Compute Budget")
        .map((i) => i.program),
    ),
  ];
  return `${decoded.success ? "" : "FAILED: "}${programs.join(", ") || "no instructions"}`;
}

export class TxExplainerAgent extends Agent<Env, State> {
  initialState: State = { current: null, recent: [] };

  validateStateChange(_next: State, source: Connection | "server") {
    if (source !== "server") throw new Error("State is read-only for clients.");
  }

  @callable()
  async explain(
    input: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const parsed = parseInput(input); // re-validated here: the socket is a trust boundary
    if (!parsed.ok) return parsed;

    const runId = crypto.randomUUID();
    const { signature, cluster } = parsed;
    this.setState({
      ...this.state,
      current: {
        runId,
        startedAt: Date.now(),
        signature,
        cluster,
        status: "fetching",
      },
    });

    try {
      await this.env.EXPLAIN_TX.create({
        id: runId,
        params: { sessionId: this.name, runId, signature, cluster },
      });
    } catch (e) {
      await this.report(runId, {
        status: "error",
        error: `Could not start the workflow: ${errorMessage(e)}`,
      });
    }
    return { ok: true };
  }

  async report(runId: string, patch: ReportPatch): Promise<void> {
    const cur = this.state.current;
    if (!cur || cur.runId !== runId) return; // superseded by a newer lookup

    const current: Current = { ...cur, ...patch };
    let recent = this.state.recent;
    if (current.status === "done" && current.decoded) {
      const entry: Recent = {
        signature: current.signature,
        cluster: current.cluster,
        summary: recentSummary(current.decoded, current.explanation),
        at: Date.now(),
      };
      recent = [
        entry,
        ...recent.filter(
          (r) => r.signature !== entry.signature || r.cluster !== entry.cluster,
        ),
      ].slice(0, MAX_RECENT);
    }
    this.setState({ current, recent });
  }
}
