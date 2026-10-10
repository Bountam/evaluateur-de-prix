import { Router } from "express";
import modelsRoutes from "./models.routes.ts";
import scrapingRoutes from "./scraping.routes.ts";
import excelRoutes from "./excel.routes.ts";
import systemRoutes from "./system.routes.ts";

const apiRouter = Router();

apiRouter.use(modelsRoutes);
apiRouter.use(scrapingRoutes);
apiRouter.use(excelRoutes);
apiRouter.use(systemRoutes);

export default apiRouter;
