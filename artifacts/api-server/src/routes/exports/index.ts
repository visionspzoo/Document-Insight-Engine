import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jobsTable, resultsTable } from "@workspace/db";
import {
  ExportJobResultsParams,
  ExportJobResultsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jobs/:id/export", async (req, res): Promise<void> => {
  const params = ExportJobResultsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = ExportJobResultsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const results = await db.select().from(resultsTable).where(eq(resultsTable.jobId, params.data.id));

  const format = query.data.format;

  if (format === "json") {
    const data = results.map((r) => ({
      id: r.id,
      document: r.documentFilename,
      extractedData: r.extractedData,
      analysisResult: r.analysisResult,
      createdAt: r.createdAt,
    }));
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${job.name}-results.json"`);
    res.send(JSON.stringify(data, null, 2));
    return;
  }

  if (format === "csv") {
    const headers = ["id", "document", "extracted_data", "analysis_result", "created_at"];
    const rows = results.map((r) => [
      r.id,
      r.documentFilename ?? "",
      (r.extractedData ?? "").replace(/"/g, '""').replace(/\n/g, " "),
      (r.analysisResult ?? "").replace(/"/g, '""').replace(/\n/g, " "),
      r.createdAt?.toISOString() ?? "",
    ]);
    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(",")),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${job.name}-results.csv"`);
    res.send("\uFEFF" + csv); // BOM for Excel UTF-8
    return;
  }

  if (format === "xml") {
    const xmlRows = results
      .map(
        (r) =>
          `  <result>
    <id>${r.id}</id>
    <document><![CDATA[${r.documentFilename ?? ""}]]></document>
    <extractedData><![CDATA[${r.extractedData ?? ""}]]></extractedData>
    <analysisResult><![CDATA[${r.analysisResult ?? ""}]]></analysisResult>
    <createdAt>${r.createdAt?.toISOString() ?? ""}</createdAt>
  </result>`,
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<results job="${job.name}">
${xmlRows}
</results>`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${job.name}-results.xml"`);
    res.send(xml);
    return;
  }

  res.status(400).json({ error: "Unsupported format" });
});

export default router;
