import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatMistralAI } from "@langchain/mistralai";
import { MistralAIEmbeddings } from "@langchain/mistralai";
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

    case "mistral":
      return new ChatMistralAI({
        apiKey: env.MISTRAL_API_KEY,
        model: "codestral-latest",
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

    case "mistral":
      return new MistralAIEmbeddings({
        model: "mistral-embed",
      });
    default:
      throw new Error("Invalid EMBEDDING_PROVIDER");
  }
}
