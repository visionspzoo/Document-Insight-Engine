import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, promptsTable } from "@workspace/db";
import {
  CreatePromptBody,
  GetPromptParams,
  UpdatePromptParams,
  UpdatePromptBody,
  DeletePromptParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/prompts", async (req, res): Promise<void> => {
  const prompts = await db.select().from(promptsTable).orderBy(promptsTable.createdAt);
  res.json(prompts);
});

router.post("/prompts", async (req, res): Promise<void> => {
  const parsed = CreatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prompt] = await db.insert(promptsTable).values(parsed.data).returning();
  res.status(201).json(prompt);
});

router.get("/prompts/:id", async (req, res): Promise<void> => {
  const params = GetPromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [prompt] = await db.select().from(promptsTable).where(eq(promptsTable.id, params.data.id));
  if (!prompt) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.json(prompt);
});

router.patch("/prompts/:id", async (req, res): Promise<void> => {
  const params = UpdatePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [prompt] = await db.update(promptsTable).set(parsed.data).where(eq(promptsTable.id, params.data.id)).returning();
  if (!prompt) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.json(prompt);
});

router.delete("/prompts/:id", async (req, res): Promise<void> => {
  const params = DeletePromptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [prompt] = await db.delete(promptsTable).where(eq(promptsTable.id, params.data.id)).returning();
  if (!prompt) {
    res.status(404).json({ error: "Prompt not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
