import type { InferUITools, Tool, UIMessage } from "ai";
import type { TurnContext } from "../context";
import type { ChatDataParts, MessageMetadata } from "../types";
import { delegateTools } from "./delegate";
import { analyzeTools } from "./analyze";
import { researchTools } from "./research";
import { documentTools } from "./documents";
import { hookTools } from "./hooks";
import { knowledgeTools } from "./knowledge";
import { memoryTools } from "./memory";
import { optionTools } from "./options";
import { strategyTools } from "./strategy";
import { templateTools } from "./templates";
import { visualTools } from "./visuals";

function baseTools(ctx: TurnContext) {
  return { ...memoryTools(ctx), ...knowledgeTools(ctx), ...strategyTools(ctx), ...delegateTools(ctx), ...documentTools(ctx), ...hookTools(ctx), ...analyzeTools(ctx), ...optionTools(), ...templateTools(ctx) };
}

/**
 * Every tool the orchestrator gets this turn. `web_search` (provider-executed) is added only when the
 * user has web search on and the caller supplies the tool. Later tasks add their groups here.
 */
export function buildTools(ctx: TurnContext, opts: { webSearchTool?: Tool | null } = {}) {
  // Web access is `researchTopic` (dated, sourced, windowed); the provider's own `web_search` is no longer given to the model.
  const tools: ReturnType<typeof baseTools> & Partial<ReturnType<typeof researchTools>> & Partial<ReturnType<typeof visualTools>> = baseTools(ctx);
  if (ctx.visuals) Object.assign(tools, visualTools(ctx));
  if (ctx.selections.webSearchEnabled && ctx.research.provider) Object.assign(tools, researchTools(ctx));
  void opts;
  return tools;
}

export type ChatTools = InferUITools<ReturnType<typeof buildTools>>;
export type ChatUIMessage = UIMessage<MessageMetadata, ChatDataParts, ChatTools>;
