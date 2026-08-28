import { Router } from "express";
import { gameRouter } from "./game.routes";

export const apiRouter: Router = Router();

apiRouter.use("/games", gameRouter);

export default apiRouter;
