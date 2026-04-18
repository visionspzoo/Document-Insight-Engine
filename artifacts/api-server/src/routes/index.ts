import { Router, type IRouter } from "express";
import healthRouter from "./health";
import promptsRouter from "./prompts";
import jobsRouter from "./jobs";
import exportsRouter from "./exports";
import statsRouter from "./stats";
import promptTemplatesRouter from "./prompt-templates";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(promptsRouter);
router.use(jobsRouter);
router.use(exportsRouter);
router.use(statsRouter);
router.use(promptTemplatesRouter);
router.use(adminRouter);

export default router;
