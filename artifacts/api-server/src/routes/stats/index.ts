import { Router, type IRouter } from "express";
import { db, jobsTable, documentsTable, resultsTable, promptsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats/dashboard", async (req, res): Promise<void> => {
  const [totalJobsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(jobsTable);
  const [completedJobsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(sql`${jobsTable.status} = 'completed'`);
  const [processingJobsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(sql`${jobsTable.status} = 'processing'`);
  const [totalDocsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(documentsTable);
  const [totalResultsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(resultsTable);
  const [savedPromptsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(promptsTable);

  res.json({
    totalJobs: totalJobsResult?.count ?? 0,
    completedJobs: completedJobsResult?.count ?? 0,
    processingJobs: processingJobsResult?.count ?? 0,
    totalDocuments: totalDocsResult?.count ?? 0,
    totalResults: totalResultsResult?.count ?? 0,
    savedPrompts: savedPromptsResult?.count ?? 0,
  });
});

router.get("/stats/recent-jobs", async (req, res): Promise<void> => {
  const jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt)).limit(5);
  res.json(jobs);
});

export default router;
