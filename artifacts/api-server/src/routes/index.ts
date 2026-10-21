import { Router, type IRouter } from "express";
import healthRouter from "./health";
import demoRouter from "./demo";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/demo",demoRouter);

export default router;
