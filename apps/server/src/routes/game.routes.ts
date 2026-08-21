import { Router } from "express";
import {
  createGame,
  joinGame,
  getGames,
  getGameById,
} from "../controllers/game.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export const gameRouter: Router = Router();

gameRouter.get("/", getGames);
gameRouter.get("/:gameId", getGameById);
gameRouter.post("/", authMiddleware, createGame);
gameRouter.post("/:gameId/join", authMiddleware, joinGame);

export default gameRouter;
