import { Router } from "express";
import { runProductAgent } from "../agent/03_agent";
import {
  appendToHistory,
  buildContextualQuery,
  ensureThreadId,
  getHistory,
} from "../agent/04_memory";
import { retrievalRelevantChunks } from "../kb/05_retriver";
import { BLOCK_THRESHOLD, CONFIDENCE_THRESHOLD } from "../agent/01_policy";

export const agentRouter = Router();

agentRouter.post("/chat", async (req, res) => {
  try {
    const { message, threadId: incomingThreadId } = req.body as {
      message?: string;
      threadId?: string;
    };

    // ----------- VALIDATION ───
    if (!message || !message.trim()) {
      return res.status(400).json({
        ok: false,
        message: "Message is required",
      });
    }

    const cleanMessage = message.trim();
    const threadId = await ensureThreadId(incomingThreadId);
    const history = await getHistory(threadId);
    console.log("RAW HISTORY FROM DB:", JSON.stringify(history, null, 2));
    console.log("HISTORY LENGTH:", history.length);

    const contextualQuery = buildContextualQuery(history, cleanMessage);

    //------ PRE-RETRIEVAL GATE ------
    const preCheck = await retrievalRelevantChunks(
      contextualQuery,
      "default",
      2,
    );
    console.log(
      "PRECHECK CONFIDENCE:",
      preCheck.confidence,
      "for:",
      cleanMessage,
    );
    if (preCheck.confidence < BLOCK_THRESHOLD) {
      const now = new Date();

      const userMsg = {
        role: "user" as const,
        content: cleanMessage,
        ts: now,
        status: "success" as const,
      };

      const assistantMsg = {
        role: "assistant" as const,
        content: "I don't know based on the available documentation.",
        ts: now,
        status: "blocked" as const,
      };

      // ✅ atomic write
      await appendToHistory(threadId, userMsg, assistantMsg);

      return res.json({
        ok: true,
        threadId,
        answer: assistantMsg.content,
        citations: [],
        retrievalStatus: "blocked",
        confidence: preCheck.confidence,
      });
    }

    // ── NORMAL FLOW ────────────────────────────────────────────

    const userTime = new Date();

    const userMsg = {
      role: "user" as const,
      content: cleanMessage,
      ts: userTime,
      status: "success" as const,
    };

    const messagesForAgent = [...history, userMsg];

    let answer: string;
    let citations: any[] = [];
    let llmFailed = false;
    let usedKb = false;
    try {
      const result = await runProductAgent(messagesForAgent);
      answer = result.answer;
      citations = result.citations;
      usedKb = result.usedKb;
    } catch (err) {
      //  LLM failure fallback
      llmFailed = true;
      answer = "Something went wrong. Please try again.";
      citations = [];
    }

    const assistantTime = new Date();

    const assistantMsg = {
      role: "assistant" as const,
      content: answer,
      ts: assistantTime,
      status: llmFailed
        ? ("error" as const)
        : !usedKb
          ? ("blocked" as const)
          : ("success" as const),
    };

    //  atomic write (user + assistant together)
    await appendToHistory(threadId, userMsg, assistantMsg);

    return res.json({
      ok: true,
      threadId,
      answer,
      citations,
      retrievalStatus:
        preCheck.confidence >= CONFIDENCE_THRESHOLD ? "success" : "partial",
      confidence: preCheck.confidence,
      latencyMs: assistantTime.getTime() - userTime.getTime(), // ✅ useful metric
    });
  } catch (e) {
    console.error(e);

    return res.status(500).json({
      ok: false,
      message: "Internal server error",
    });
  }
});
