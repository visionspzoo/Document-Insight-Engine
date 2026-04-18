import { Router, type IRouter } from "express";
import healthRouter from "./health";
import promptsRouter from "./prompts";
import jobsRouter from "./jobs";
import exportsRouter from "./exports";
import statsRouter from "./stats";
import promptTemplatesRouter from "./prompt-templates";

const router: IRouter = Router();

router.use(healthRouter);
router.use(promptsRouter);
router.use(jobsRouter);
router.use(exportsRouter);
router.use(statsRouter);
router.use(promptTemplatesRouter);

export default router;
