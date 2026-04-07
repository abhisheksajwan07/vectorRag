import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { Collection as MongoCollection } from "mongodb";
import { getEmbeddingModel } from "../utils/llm.factory";
import { getDb } from "../utils/mongo";
import { env } from "../utils/env";

const KB_COLLECTION_NAME = "kb_chunks";
const KB_INDEX_NAME = "vector_index";

let collectionPromise: Promise<MongoCollection> | null = null;
let vectorStorePromise: Promise<MongoDBAtlasVectorSearch> | null = null;

export async function getKbCollection(): Promise<MongoCollection> {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const db = await getDb();
      return db.collection(KB_COLLECTION_NAME);
    })();
  }
  return collectionPromise;
}

export async function getVectorStore(): Promise<MongoDBAtlasVectorSearch> {
  if (!vectorStorePromise) {
    vectorStorePromise = (async () => {
      const collection = await getKbCollection();
      const embedding = getEmbeddingModel();

      // const testEmbed = await embedding.embedQuery("hello");
      // if (!testEmbed || testEmbed.length === 0) {
      //   throw new Error("Embedding model returned empty vector");
      // }
      // console.log(`Embedding model ready — dimensions: ${testEmbed.length}`);
     
      const vectorStore = new MongoDBAtlasVectorSearch(embedding, {
        collection: collection as any,
        indexName: KB_INDEX_NAME,
        textKey: "text",
        embeddingKey: "embedding",
      });
      return vectorStore;
    })();
  }
  return vectorStorePromise;
}
