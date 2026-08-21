import { Router } from "express";
import { authRouter } from "./auth.routes";
import { gameRouter } from "./game.routes";

export const apiRouter: Router = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/games", gameRouter);

export default apiRouter;
