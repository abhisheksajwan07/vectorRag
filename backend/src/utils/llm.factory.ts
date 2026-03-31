import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { OpenAIEmbeddings } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google";
import { TaskType } from "@google/generative-ai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env } from "./env";

type ModelOpts = {
  temperature?: number;
};

export function getChatModel(opts: ModelOpts = {}): BaseChatModel {
  const temp = opts.temperature ?? 0.2;

  switch (env.MODEL_PROVIDER) {
    case "groq":
      return new ChatGroq({
        apiKey: env.GROQ_API_KEY,
        model: env.GROQ_MODEL,
        temperature: temp,
      });
    case "openai":
      return new ChatOpenAI({
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        temperature: temp,
      });
    default:
      throw new Error("Invalid MODEL_PROVIDER");
  }
}

export function getEmbeddingModel() {
  switch (env.EMBEDDING_PROVIDER) {
    case "openai":
      return new OpenAIEmbeddings({
        openAIApiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_EMBEDDING_MODEL,
      });
    case "gemini":
      return new GoogleGenerativeAIEmbeddings({
        apiKey: env.GEMINI_API_KEY,
        taskType: TaskType.RETRIEVAL_DOCUMENT,
        modelName: env.GEMINI_EMBEDDING_MODEL,
      });
    default:
      throw new Error("Invalid EMBEDDING_PROVIDER");
  }
}
