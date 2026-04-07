import { Document } from "@langchain/core/documents";
import { getVectorStore, getKbCollection } from "./03_vectorStore";

export interface IngestSummary {
  ok: boolean;
  replaced: boolean; // true if this was an update
  namespace: string;
  totalChunks: number;
  sources: string[];
}

export async function ingestDocument(
  namespace: string,
  chunks: Document[],
): Promise<IngestSummary> {
  if (!namespace) {
    throw new Error("namespace is needed");
  }

  if (!chunks.length) {
    return {
      ok: false,
      replaced: false,
      namespace,
      totalChunks: 0,
      sources: [],
    };
  }

  
  // If the user uploads the same file again, the old chunks are stale.
  // We delete them first so we don't accumulate duplicates in the vector store.
  const collection = await getKbCollection();
  const sources = Array.from(
    new Set(
      chunks.map((c) => (c?.metadata?.source as string) || "unknown_source"),
    ),
  );

  

  const deleteResult= await collection.deleteMany({
    "namespace": namespace,
    "source": { $in: sources },
  });

  // console.log("deleted result",deleteResult)

  const replaced = deleteResult.deletedCount > 0
  // ─────────────

  const vectorStore = await getVectorStore();

  let currentId = 0;

  const docsWithMeta = chunks.map((chunk) => {
    const source = (chunk?.metadata?.source as string) || "unknown_source";

    const doc = new Document({
      pageContent: chunk.pageContent,
      metadata: {
        namespace,
        source,
        chunkId: currentId++,
      },
    });

    return doc;
  });

  await vectorStore.addDocuments(docsWithMeta);

  return {
    ok: true,
    replaced,
    namespace,
    totalChunks: docsWithMeta.length,
    sources,
  };
}
