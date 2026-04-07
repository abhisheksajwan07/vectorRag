import { Router } from "express";
import { runProductAgent } from "../agent/03_agent";
import {
  appendToHistory,
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

    // ── VALIDATION ─────────────────────────────────────────────
    if (!message || !message.trim()) {
      return res.status(400).json({
        ok: false,
        message: "Message is required",
      });
    }

    const cleanMessage = message.trim();
    const threadId = await ensureThreadId(incomingThreadId);

    // ── PRE-RETRIEVAL GATE ─────────────────────────────────────
    const preCheck = await retrievalRelevantChunks(cleanMessage, "default", 2);

    if (preCheck.confidence < BLOCK_THRESHOLD) {
      const now = new Date();

      const userMsg = {
        role: "user" as const,
        content: cleanMessage,
        ts: now,
      };

      const assistantMsg = {
        role: "assistant" as const,
        content: "I don't know based on the available documentation.",
        ts: now,
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
    const history = await getHistory(threadId);

    const userTime = new Date();

    const userMsg = {
      role: "user" as const,
      content: cleanMessage,
      ts: userTime,
    };

    const messagesForAgent = [...history, userMsg];

    let answer: string;
    let citations: any[] = [];

    try {
      const result = await runProductAgent(messagesForAgent);
      answer = result.answer;
      citations = result.citations;
    } catch (err) {
      // ❗ LLM failure fallback
      answer = "Something went wrong. Please try again.";
      citations = [];
    }

    const assistantTime = new Date();

    const assistantMsg = {
      role: "assistant" as const,
      content: answer,
      ts: assistantTime,
    };

    // ✅ atomic write (user + assistant together)
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
