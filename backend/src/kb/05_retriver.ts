import type { Document } from "@langchain/core/documents";
import { getVectorStore } from "./03_vectorStore";

export interface RetrieverResult {
  docs: Document[];
  confidence: number;
}

export async function retrievalRelevantChunks(
  query: string,
  namespace: string = "default",
  k: number = 2,
): Promise<RetrieverResult> {
  // console.log("STEP 1: function called");

  if (!query.trim()) {
    return {
      docs: [],
      confidence: 0,
    };
  }
  const vectorStore = await getVectorStore();
  // console.log("STEP 2: got vectorStore", vectorStore);
  try {
    const results = await vectorStore.similaritySearchWithScore(query, k, {
      namespace,
    });

    // console.log("STEP 3: results", results);

    if (!results?.length) {
      console.log("STEP 4: empty results");
      return { docs: [], confidence: 0 };
    }

    const docs = results.map(([doc]) => doc);
    const scores = results.map(([_, score]) => score);

    const best = Math.max(...scores);
    const normalized = Math.max(0, Math.min(1, best));
    const confidence = Number(normalized.toFixed(2));

    // console.log("STEP 5: confidence", confidence);

    return { docs, confidence };
  } catch (err) {
    console.error("RETRIEVER ERROR:", err);
    return { docs: [], confidence: 0 };
  }
}
