import { Router } from "express";
import { createGame, joinGame } from "../controllers/game.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export const gameRouter: Router = Router();

gameRouter.post("/", authMiddleware, createGame);
gameRouter.post("/:gameId/join", authMiddleware, joinGame);

export default gameRouter;
