import { z } from "zod";
import { createAgent, providerStrategy } from "langchain";
import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
} from "@langchain/core/messages";
import { getChatModel } from "../utils/llm.factory";
import { agentTools } from "./02_tools";
import { AGENT_SYSTEM_PROMPT } from "./01_policy";


// ── 1. Schema — single source of truth ──
const AgentResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(
    z.object({
      source: z.string(),
      chunkId: z.number(),
      preview: z.string(),
    }),
  ),
});

// infer the TypeScript type directly from Zod schema
type AgentResponse = z.infer<typeof AgentResponseSchema> & { usedKb: boolean };

// ── 2. Agent ──
export const ProductAgent = createAgent({
  model: getChatModel(),
  tools: agentTools,
  systemPrompt: AGENT_SYSTEM_PROMPT,
  // responseFormat: providerStrategy(AgentResponseSchema),
});

// ── 3. Runner ───
export async function runProductAgent(
  messages: { role: string; content: string }[], // no more "any"
): Promise<AgentResponse> {
  const state = await ProductAgent.invoke({ messages });

  console.log(state);

  const usedKb = state.messages.some((m) => m instanceof ToolMessage);

  // find last AI message that has actual content and no pending tool calls
  const lastAIMessage = [...state.messages]
    .reverse()
    .find(
      (m: any) =>
        (m instanceof AIMessage || m instanceof AIMessageChunk) &&
        (!m.tool_calls || m.tool_calls.length === 0) &&
        m.content !== "",
    );

  // console.log(lastAIMessage);

  if (!lastAIMessage) {
    throw new Error("no valid AI response found in agent state");
  }

  const content = lastAIMessage.content as string;

  const clean = content.replace(/```json\s*|```/g, "").trim();
  console.log("clean content", JSON.stringify(clean));
  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    console.log("fallback triggered....");
    return {
      answer: content,
      citations: [],
      usedKb: usedKb,
    };
  }

  const result = AgentResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Response shape invalid: ${result.error.message}`);
  }

  return {
    ...result.data,
    usedKb: true,
  };
}
