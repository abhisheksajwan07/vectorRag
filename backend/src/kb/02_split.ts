import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP_SIZE = 150;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: DEFAULT_CHUNK_SIZE,
  chunkOverlap: DEFAULT_CHUNK_OVERLAP_SIZE,
  separators: ["\n\n", "\n", ". ", " "],
});
function debugChunks(chunks: Document[]) {
  chunks.forEach((chunk, i) => {
    console.log("\n==============================");
    console.log(`CHUNK ${i}`);
    console.log("Length:", chunk.pageContent.length);

    console.log("START:");
    console.log(chunk.pageContent.slice(0, 120));

    console.log("END:");
    console.log(chunk.pageContent.slice(-120));
  });
}

export async function splitDocument(docs: Document[]): Promise<Document[]> {
  if (!docs.length) return [];
  const chunks = await splitter.splitDocuments(docs);
  debugChunks(chunks)
  console.log("TOTAL CHUNKS CREATED:", chunks.length);
  chunks.forEach((c, i) =>
    console.log(`CHUNK ${i}:`, c.pageContent.slice(0, 100)),
  );
  return chunks.map((chunk,index) => {
    const base = chunk?.metadata ?? {};
    return new Document({
      pageContent: chunk?.pageContent.trim(),
      metadata: {
        ...base,
        source: base?.source ?? "unknown_source",
        chunkIndex: index,
      },
    });
  });
}
