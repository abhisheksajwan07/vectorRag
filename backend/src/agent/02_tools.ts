import { z } from "zod";
import { tool } from "langchain";
import { retrievalRelevantChunks } from "../kb/05_retriver";
import { BLOCK_THRESHOLD, CONFIDENCE_THRESHOLD } from "./01_policy";

const DEFAULT_NAMESPACE = "default";

export const kbSearchTool = tool(
  async ({ question }: { question: string }) => {
    const ns = DEFAULT_NAMESPACE;

    const { docs, confidence } = await retrievalRelevantChunks(question, ns, 6);

    const contexts = docs.map((doc) => {
      const source = (doc?.metadata?.source as string) || "unknown_source";

      const chunkId = (doc?.metadata?.chunkId as number) ?? 0;

      const preview =
        doc.pageContent.length > 0
          ? doc.pageContent.slice(0, 800) + "..."
          : doc.pageContent;
      return {
        source,
        chunkId,
        preview,
      };
    });

    if (confidence < BLOCK_THRESHOLD) {
      return {
        confidence,
        blocked: true,
        contexts: [],
        reason: "Confidence too low. No relevant chunks found.",
      };
    }

    if (confidence < CONFIDENCE_THRESHOLD) {
      return {
        confidence,
        blocked: false,
        partial: true,
        contexts,
        reason: "Partial match. Answer may be incomplete.",
      };
    }

    return {
      confidence,
      blocked: false,
      ns,
      contexts,
    };
  },
  {
    name: "kb_search",
    description: "Search the documentation KB for relevant answers",
    schema: z.object({
      question: z
        .string()
        .describe(
          `User's question or follow up that must be answered from docs`,
        ),
    }),
  },
);

export const agentTools = [kbSearchTool];
