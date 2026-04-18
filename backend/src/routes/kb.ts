import { Router } from "express";
import multer from "multer";
import { loadFileAsDocument } from "../kb/01_loader";
import {  splitParentChild } from "../kb/02_split";
import { ingestDocument } from "../kb/04_ingest";

import { getKbCollection } from "../kb/03_vectorStore";

export const kbRouter = Router();
const upload = multer({
  dest: "uploads/",
  limits: {
    fieldSize: 10 * 1024 * 1024,
  },
});

kbRouter.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log(req.file);
    const namespace = "default";
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: "no file uploaded.please upload a file before processing",
      });
    }
    const { path, mimetype, originalname } = req.file;

    const rawDocs = await loadFileAsDocument({
      mimeType: mimetype,
      originalName: originalname,
      filePath: path,
    });
    if (!rawDocs.length) {
      return res.status(400).json({
        ok: false,
        message: "Upsupported or empty file",
      });
    }

    const { parents, children } = await splitParentChild(rawDocs);

    if (!children.length) {
      return res.status(400).json({
        ok: false,
        message: "no usable chunks after splitting",
      });
    }

    const summary = await ingestDocument(children, namespace);
    console.log(summary)
    const collection = await getKbCollection();
    await collection.insertMany(
      parents.map((p) => ({
        pageContent: p.pageContent,
        metadata: {
          ...p.metadata,
          namespace,
        },
      })),
    );

    return res.status(200).json({
      ok: summary.ok,
      replaced: summary.replaced, // true = same file was re-uploaded
      namespace: summary.namespace,
      totalChunks: summary.totalChunks,
      sources: summary.sources,
      parentStored :parents.length
    });
  } catch (err) {
    console.error("KB[ROUTER]/upload failed:", err);
    res.status(500).json({
      message: "Something went wrong while uploading the file",
      ok: false,
    });
  }
});
