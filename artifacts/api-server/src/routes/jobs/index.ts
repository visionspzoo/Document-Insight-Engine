import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { eq, and } from "drizzle-orm";
import { db, jobsTable, documentsTable, resultsTable, promptsTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { batchProcessWithSSE } from "@workspace/integrations-anthropic-ai/batch";
import {
  CreateJobBody,
  GetJobParams,
  DeleteJobParams,
  ProcessJobParams,
  UploadDocumentParams,
  DeleteDocumentParams,
  ListJobResultsParams,
  ExportJobResultsParams,
  ExportJobResultsQueryParams,
} from "@workspace/api-zod";
import { logger } from "../../lib/logger";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/tiff", "text/plain"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

const router: IRouter = Router();

router.get("/jobs", async (req, res): Promise<void> => {
  const jobs = await db.select().from(jobsTable).orderBy(jobsTable.createdAt);
  res.json(jobs);
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [job] = await db.insert(jobsTable).values(parsed.data).returning();
  res.status(201).json(job);
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const documents = await db.select().from(documentsTable).where(eq(documentsTable.jobId, params.data.id));
  const results = await db.select().from(resultsTable).where(eq(resultsTable.jobId, params.data.id));
  let prompt = null;
  if (job.promptId) {
    const [p] = await db.select().from(promptsTable).where(eq(promptsTable.id, job.promptId));
    prompt = p ?? null;
  }
  res.json({ ...job, documents, results, prompt });
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.delete(jobsTable).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/jobs/:id/documents", upload.single("file"), async (req, res): Promise<void> => {
  const params = UploadDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [doc] = await db
    .insert(documentsTable)
    .values({
      jobId: params.data.id,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      status: "pending",
    })
    .returning();

  await db
    .update(jobsTable)
    .set({ documentCount: job.documentCount + 1 })
    .where(eq(jobsTable.id, params.data.id));

  res.status(201).json(doc);
});

router.delete("/jobs/:jobId/documents/:docId", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.docId), eq(documentsTable.jobId, params.data.jobId)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await db.delete(documentsTable).where(eq(documentsTable.id, params.data.docId));
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.jobId));
  if (job) {
    await db
      .update(jobsTable)
      .set({ documentCount: Math.max(0, job.documentCount - 1) })
      .where(eq(jobsTable.id, params.data.jobId));
  }
  res.sendStatus(204);
});

router.get("/jobs/:id/results", async (req, res): Promise<void> => {
  const params = ListJobResultsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const results = await db.select().from(resultsTable).where(eq(resultsTable.jobId, params.data.id));
  res.json(results);
});

router.post("/jobs/:id/process", async (req, res): Promise<void> => {
  const params = ProcessJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const documents = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.jobId, params.data.id), eq(documentsTable.status, "pending")));

  if (documents.length === 0) {
    res.status(400).json({ error: "No pending documents to process" });
    return;
  }

  let prompt = null;
  if (job.promptId) {
    const [p] = await db.select().from(promptsTable).where(eq(promptsTable.id, job.promptId));
    prompt = p ?? null;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  await db
    .update(jobsTable)
    .set({ status: "processing" })
    .where(eq(jobsTable.id, params.data.id));

  send({ type: "start", total: documents.length, jobId: params.data.id });

  let processedCount = 0;
  let failedCount = 0;

  await batchProcessWithSSE(
    documents,
    async (doc) => {
      await db.update(documentsTable).set({ status: "processing" }).where(eq(documentsTable.id, doc.id));

      const extractionInstruction = prompt?.extractionPrompt ||
        "Wyodrębnij wszystkie istotne informacje z dokumentu w formie strukturyzowanej.";

      let textContent = doc.extractedText || "";

      if (!textContent) {
        if (doc.mimeType === "text/plain") {
          textContent = "[Treść dokumentu tekstowego]";
        } else {
          textContent = `[Dokument: ${doc.filename}, typ: ${doc.mimeType}, rozmiar: ${doc.sizeBytes} bajtów]`;
        }
      }

      const extractionMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `${extractionInstruction}\n\nDokument:\n${textContent}`,
          },
        ],
      });

      const extractedBlock = extractionMessage.content[0];
      const extractedData = extractedBlock.type === "text" ? extractedBlock.text : "";

      let analysisResult = "";
      if (prompt?.analysisPrompt && extractedData) {
        const analysisMessage = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          messages: [
            {
              role: "user",
              content: `${prompt.analysisPrompt}\n\nWyodrębnione dane:\n${extractedData}`,
            },
          ],
        });
        const analysisBlock = analysisMessage.content[0];
        analysisResult = analysisBlock.type === "text" ? analysisBlock.text : "";
      }

      await db.update(documentsTable).set({ status: "completed", extractedText: textContent }).where(eq(documentsTable.id, doc.id));

      await db.insert(resultsTable).values({
        jobId: params.data.id,
        documentId: doc.id,
        documentFilename: doc.filename,
        extractedData,
        analysisResult: analysisResult || null,
        rawResponse: JSON.stringify(extractionMessage),
      });

      processedCount++;
      await db.update(jobsTable).set({ processedCount }).where(eq(jobsTable.id, params.data.id));

      return extractedData;
    },
    (event) => {
      send({ ...event });
    },
    { retries: 3 },
  ).catch(async (err) => {
    failedCount++;
    logger.error({ err }, "Error processing document batch");
  });

  const finalStatus = failedCount > 0 ? "failed" : "completed";
  await db
    .update(jobsTable)
    .set({ status: finalStatus, processedCount })
    .where(eq(jobsTable.id, params.data.id));

  send({ type: "done", processedCount, failedCount, status: finalStatus });
  res.end();
});

router.post("/jobs/:jobId/documents/:docId/reset", async (req, res): Promise<void> => {
  const jobId = Number(req.params.jobId);
  const docId = Number(req.params.docId);
  if (!Number.isFinite(jobId) || !Number.isFinite(docId)) {
    res.status(400).json({ error: "Nieprawidłowe ID." });
    return;
  }
  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, docId), eq(documentsTable.jobId, jobId)));
  if (!doc) {
    res.status(404).json({ error: "Dokument nie znaleziony." });
    return;
  }
  await db.delete(resultsTable).where(and(eq(resultsTable.jobId, jobId), eq(resultsTable.documentId, docId)));
  await db.update(documentsTable).set({ status: "pending" }).where(eq(documentsTable.id, docId));
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (job && job.processedCount > 0) {
    await db.update(jobsTable).set({ processedCount: Math.max(0, job.processedCount - 1) }).where(eq(jobsTable.id, jobId));
  }
  res.json({ ok: true });
});

router.post("/jobs/:id/analyze", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Nieprawidłowe ID." });
    return;
  }
  const analysisPrompt = String((req.body as { analysisPrompt?: string }).analysisPrompt ?? "").trim();
  if (!analysisPrompt) {
    res.status(400).json({ error: "Brak prompta analizy." });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) {
    res.status(404).json({ error: "Zadanie nie znalezione." });
    return;
  }

  if (job.promptId) {
    await db.update(promptsTable).set({ analysisPrompt }).where(eq(promptsTable.id, job.promptId));
  }

  const targets = await db.select().from(resultsTable).where(eq(resultsTable.jobId, id));
  if (targets.length === 0) {
    res.status(400).json({ error: "Brak wyników do analizy." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: "start", total: targets.length, jobId: id });

  let processed = 0;
  let failed = 0;

  await batchProcessWithSSE(
    targets,
    async (result) => {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `${analysisPrompt}\n\nWyodrębnione dane:\n${result.extractedData ?? ""}`,
          },
        ],
      });
      const block = message.content[0];
      const analysisResult = block.type === "text" ? block.text : "";
      await db.update(resultsTable).set({ analysisResult }).where(eq(resultsTable.id, result.id));
      processed++;
      return analysisResult;
    },
    (event) => send({ ...event, processedCount: processed }),
    { retries: 2 },
  ).catch((err) => {
    failed++;
    logger.error({ err }, "Error during analysis batch");
  });

  send({ type: "done", processedCount: processed, failedCount: failed, status: failed > 0 ? "failed" : "completed" });
  res.end();
});

export default router;
