import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";

interface loadFileArgs {
  mimeType: string;
  originalName: string;
  filePath: string;
}

function getExt(name: string): string {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index + 1).toLowerCase();
}

/**
 *
 * @param args - Object containing file details
 * @param args.mimeType - MIME type of the file (e.g. application/pdf)
 * @param args.originalName - Original file name (used to detect extension)
 * @param args.filePath - Local file path where file is stored
 * @returns Promise that resolves to an array of Document objects
 * Each document represents a chunk of extracted text with metadata
 */
export async function loadFileAsDocument(
  args: loadFileArgs,
): Promise<Document[]> {
  const { mimeType, originalName, filePath } = args;

  const extractExtension = getExt(originalName);

  const isMarkDown =
    mimeType === "text/markdown" ||
    extractExtension === "md" ||
    extractExtension === "markdown";

  const isText = mimeType === "text/plain" || extractExtension === "txt";

  const isPdf = mimeType === "application/pdf" || extractExtension === "pdf";

  if (isPdf) {
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    return docs.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        source: originalName,
      },
    }));
  }

  if (isText || isMarkDown) {
    const loader = new TextLoader(filePath);
    const docs = await loader.load();

    return docs.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        source: originalName,
      },
    }));
  }

  return [];
}
