import { Document } from "@langchain/core/documents";
import { atee } from "@langchain/core/utils/stream";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { nanoid } from "nanoid";
import { positive, promise } from "zod/v4";
import { Doc } from "zod/v4/core";

/**
 * CONFIG
 */
const PARENT_CHUNK_SIZE = 1000;
const PARENT_OVERLAP = 150;

const CHILD_CHUNK_SIZE = 500;
const CHILD_OVERLAP = 100;

const parentSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: PARENT_CHUNK_SIZE,
  chunkOverlap: PARENT_OVERLAP,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

const childSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHILD_CHUNK_SIZE,
  chunkOverlap: CHILD_OVERLAP,
  separators: ["\n\n", "\n", ". ", " ", ""],
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

export async function splitParentChild(docs: Document[]) {
  const parents: Document[] = [];
  const children: Document[] = [];
  for (const doc of docs) {
    const parentChunks = await parentSplitter.splitDocuments([doc]);
    for (const parentChunk of parentChunks) {
      const parentId = nanoid();
      const parentDoc = new Document({
        pageContent: parentChunk.pageContent.trim(),
        metadata: {
          ...(doc.metadata ?? {}),
          parentId,
          level: "parent",
        },
      });

      parents.push(parentDoc);

      const childChunks = await childSplitter.splitDocuments([
        new Document({
          pageContent: parentChunk.pageContent,
          metadata: doc.metadata,
        }),
      ]);

      childChunks.forEach((child, idx) => {
        children.push(
          new Document({
            pageContent: child.pageContent.trim(),
            metadata: {
              ...doc.metadata,
              parentId,
              subChunk: idx,
              level: "child",
            },
          }),
        );
      });
    }
  }
  return { parents, children };
}

