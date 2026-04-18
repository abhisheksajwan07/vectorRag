import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import crypto from "crypto";

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
 * clean text(important for pdf)
 */
function cleanText(text: string): string {
  return text
    .replace(/\f/g, " ")
    .replace(/([a-zA-Z]+)-\n([a-zA-z]+)/g, "$1$2") // fix hyphen breaks
    .replace(/([a-z,])\n([a-z])/g, "$1 $2") // join broken lines
    .replace(/\n{3,}/g, "\n\n") // keep paragraphs
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * generate fileId for deduplication
 */
function createFileId(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
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

  const ext = getExt(originalName);

  const isMarkDown =
    mimeType === "text/markdown" || ext === "md" || ext === "markdown";

  const isText = mimeType === "text/plain" || ext === "txt";

  const isPdf = mimeType === "application/pdf" || ext === "pdf";
  const fileType = isPdf ? "pdf" : isMarkDown ? "markdown" : "text";
  let docs: Document[] = [];
  try {
    if (isPdf) {
      const loader = new PDFLoader(filePath);
      docs = await loader.load();
    } else if (isText || isMarkDown) {
      const loader = new TextLoader(filePath);
      docs = await loader.load();
    } else {
      return [];
    }
  } catch (err) {
    throw new Error("failed to load file");
  }

  const fullText = docs.map((d) => d.pageContent).join("\n\n");

  const cleanedtext = cleanText(fullText);
  const fileId = createFileId(cleanedtext);

  return [
    new Document({
      pageContent: cleanedtext,
      metadata: {
        source: originalName,
        type: fileType,
        fileId,
      },
    }),
  ];
}
