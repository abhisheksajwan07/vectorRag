import { Document } from "@langchain/core/documents";
import { getVectorStore, getKbCollection } from "./03_vectorStore";

export interface IngestSummary {
  ok: boolean;
  replaced: boolean; // true if this was an update
  namespace: string;
  totalChunks: number;
  sources: string[];
}
const DEFAULT_NAMESPACE = "default";

export async function ingestDocument(
  chunks: Document[],
  namespace: string = DEFAULT_NAMESPACE,
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

  const deleteResult = await collection.deleteMany({
    "metadata.namespace": namespace,
    "metadata.source": { $in: sources },
  });

  // console.log("deleted result",deleteResult)

  const replaced = deleteResult.deletedCount > 0;
  // ─────────────

  const vectorStore = await getVectorStore();

  const docsWithMeta = chunks.map((chunk) => {
    return new Document({
      pageContent: chunk.pageContent,
      metadata: {
        namespace,
        source: chunk.metadata?.source,
        fileId: chunk.metadata?.fileId,
        parentId: chunk.metadata?.parentId,
        subChunk: chunk.metadata?.subChunk,
        level: chunk.metadata?.level,
      },
    });
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
