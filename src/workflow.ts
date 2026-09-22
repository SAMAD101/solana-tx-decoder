import { getAgentByName } from "agents";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type { ReportPatch } from "./agent";
import { explainTransaction } from "./ai";
import { fetchTransaction, RPC_ENV } from "./rpc";
import { decodeTransaction } from "./shared/decode";
import type { DecodedTx, ExplainParams } from "./shared/types";

const errorMessage = (e: unknown) =>
  (e instanceof Error ? e.message : String(e)).replace(/^\w*Error:\s*/, "");

export class ExplainTxWorkflow extends WorkflowEntrypoint<Env, ExplainParams> {
  async run(event: WorkflowEvent<ExplainParams>, step: WorkflowStep) {
    const { sessionId, runId, signature, cluster } = event.payload;

    // Each report is its own step so a replay after a crash does not re-send it.
    const report = (name: string, patch: ReportPatch) =>
      step.do(
        name,
        { retries: { limit: 2, delay: "1 second", backoff: "constant" } },
        async () => {
          const agent = await getAgentByName(
            this.env.TxExplainerAgent,
            sessionId,
          );
          await agent.report(runId, patch);
        },
      );

    let decoded: DecodedTx;
    try {
      const raw = await step.do(
        "fetch-tx",
        {
          retries: { limit: 2, delay: "2 seconds", backoff: "exponential" },
          timeout: "30 seconds",
        },
        () =>
          fetchTransaction(
            signature,
            cluster,
            (this.env as unknown as Record<string, string | undefined>)[
              RPC_ENV[cluster]
            ],
          ),
      );
      await report("report-decoding", { status: "decoding" });
      // Pure and deterministic: a retry would fail the same way.
      decoded = await step.do(
        "decode",
        { retries: { limit: 0, delay: 0 } },
        async () => decodeTransaction(raw, cluster),
      );
    } catch (e) {
      await report("report-error", { status: "error", error: errorMessage(e) });
      return;
    }

    await report("report-explaining", { status: "explaining", decoded });

    let explanation: string | undefined;
    let error: string | undefined;
    try {
      explanation = await step.do(
        "explain",
        {
          retries: { limit: 1, delay: "3 seconds", backoff: "constant" },
          timeout: "60 seconds",
        },
        () => explainTransaction(this.env.AI, decoded),
      );
    } catch (e) {
      error = `AI explanation failed: ${errorMessage(e)}. The decoded transaction is still shown below.`;
    }

    await report("report", { status: "done", explanation, error });
  }
}
