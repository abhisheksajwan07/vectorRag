import { Router } from "express";
import multer from "multer";
import { loadFileAsDocument } from "../kb/01_loader";
import { splitDocument } from "../kb/02_split";
import { ingestDocument } from "../kb/04_ingest";

export const kbRouter = Router();
const upload = multer({
  dest: "uploads/",
  limits: {
    fieldSize: 10 * 1021 * 1024,
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

    const chunks = await splitDocument(rawDocs);

    if (!chunks.length) {
      return res.status(400).json({
        ok: false,
        message: "file laoded but prodcued no usable chunks after splitting",
      });
    }

    const summary = await ingestDocument(namespace, chunks);
    return res.status(200).json({
      ok: summary.ok,
      namespace: summary.namespace,
      totalChunks: summary.totalChunks,
      sources: summary.sources,
    });
  } catch (err) {
    console.log(err)
    res.status(500).json({
      message: "Something went wrong while uploading the file",
      ok: false,
    });
  }
});
