import { Collection, WithId } from "mongodb";
import { getDb } from "../utils/mongo";
import { nanoid } from "nanoid";

// How many conversation turns to keep in context.
// 1 turn = 1 user message + 1 assistant reply = 2 messages.
// 6 turns = 12 messages max ever sent to the LLM per request.
// Raise this if you want longer memory. Keep it ≤ 10 to control token costs.
export const MAX_HISTORY_TURNS = 4;

export type ChatRole = "user" | "assistant";
export type Status = "success" | "error" | "blocked";
export interface ChatMessage {
  role: ChatRole;
  content: string;
  ts: Date;
  status: Status;
}

export interface ConversationDoc {
  threadId: string;
  messages: {
    role: ChatRole;
    content: string;
    ts: Date;
    status: Status;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const CONVERSATION_COLLECTION = "conversations";

let convCollectionPromise: Promise<Collection<ConversationDoc>> | null = null;

async function getConversationsCollection(): Promise<
  Collection<ConversationDoc>
> {
  if (!convCollectionPromise) {
    convCollectionPromise = (async () => {
      const db = await getDb();
      const col = db.collection<ConversationDoc>(CONVERSATION_COLLECTION);
      await col.createIndex(
        { threadId: 1 },
        {
          unique: true,
        },
      );
      return col;
    })();
  }
  return convCollectionPromise;
}

export async function ensureThreadId(
  isThreadIdPresent?: string,
): Promise<string> {
  const col = await getConversationsCollection();
  if (isThreadIdPresent) {
    const existing = await col.findOne({ threadId: isThreadIdPresent });
    if (existing) return isThreadIdPresent;
  }

  const threadId = nanoid(12);
  const now = new Date();

  await col.insertOne({
    threadId,
    messages: [],

    createdAt: now,
    updatedAt: now,
  });

  return threadId;
}

export async function getHistory(
  threadId: string,
  maxTurns: number = MAX_HISTORY_TURNS,
): Promise<ChatMessage[]> {
  const col = await getConversationsCollection();
  const conv: WithId<ConversationDoc> | null = await col.findOne({ threadId });

  if (!conv || !conv.messages.length) return [];

  const successOnly: typeof conv.messages = [];
  for (let i = 0; i < conv.messages.length - 1; i += 2) {
    let userMsg = conv.messages[i];
    let assistantMsg = conv.messages[i + 1];
    if (userMsg.status === "success" && assistantMsg.status != "error") {
      successOnly.push(userMsg, assistantMsg);
    }
  }
  console.log(successOnly);
  const raw = successOnly.slice(-(maxTurns * 2));

  const startIndex = raw[0]?.role === "assistant" ? 1 : 0;
  const safeWindow = raw.slice(startIndex);

  return safeWindow.map((msg) => ({
    role: msg.role,
    content: msg.content,
    ts: msg.ts,
    status: msg.status,
  }));
}

export async function appendToHistory(
  threadId: string,
  ...messages: ChatMessage[]
): Promise<void> {
  if (!messages.length) return;

  const col = await getConversationsCollection();

  const messagewithTs = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    ts: msg.ts,
    status: msg.status,
  }));

  await col.updateOne(
    {
      threadId,
    },
    {
      $push: {
        messages: {
          $each: messagewithTs,
        },
      },
      $set: {
        updatedAt: new Date(),
      },
    },
  );
}

export function buildContextualQuery(
  history: ChatMessage[],
  currentMessage: string,
): string {
  if (!history.length) return currentMessage;
  const lastTurns = history
    .slice(-4)
    .map((m) => `${m.role}:${m.content}`)
    .join("\n");

  return `${lastTurns}\nuser:${currentMessage}`;
}
