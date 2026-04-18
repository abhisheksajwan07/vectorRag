import { Document } from "@langchain/core/documents";
import { getKbCollection, getVectorStore } from "./03_vectorStore";

export interface RetrieverResult {
  docs: Document[];
  confidence: number;
}
function getParentId(doc:any):string|undefined {
  return doc.metadata?.parentId || doc.parentId
}
export async function retrievalRelevantChunks(
  query: string,
  namespace: string = "default",
  k: number = 5,
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
    /**
     * search child chunks
     */
    const results = await vectorStore.similaritySearchWithScore(query, k, {
      filter: {  namespace },
    });

    // console.log("STEP 3: results", results);

    if (!results?.length) {
      console.log("STEP 4: empty results");
      return { docs: [], confidence: 0 };
    }

    const parentIds = [
      ...new Set(
        results
          .map(([doc]) => getParentId(doc))
          .filter((id): id is string => typeof id === "string"),
      ),
    ];

    const collection = await getKbCollection();

    const parentDocsRaw = await collection
      .find({
        "metadata.parentId": { $in: parentIds },
        "metadata.level": "parent",
        "metadata.namespace": namespace,
      })
      .toArray();

    const docs: Document[] = parentDocsRaw.map((p) => {
      return new Document({
        pageContent: p.pageContent,
        metadata: p.metadata,
      });
    });
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
