import { routeAgentRequest } from "agents";

export { TxExplainerAgent } from "./agent";
export { ExplainTxWorkflow } from "./workflow";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /agents/tx-explainer-agent/<sessionId>: WebSocket state sync + @callable RPC.
    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
