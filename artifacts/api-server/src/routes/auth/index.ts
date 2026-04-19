import { Router, type Request, type Response } from "express";

const router = Router();

router.get("/auth/status", (_req: Request, res: Response): void => {
  res.json({ provider: "supabase", status: "ok" });
});

export default router;
