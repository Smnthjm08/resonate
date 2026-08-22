import { EventType, START_FEN, WHITE } from "@repo/game-core";
import type { Request, Response } from "express";
import { GameStatus, prisma } from "@repo/db";
import { gameSocketManager } from "../sockets/game-socket";

export const createGame = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        data: null,
        message: "Unauthorized",
      });
    }

    const existingActiveGame = await prisma.game.findFirst({
      where: {
        status: GameStatus.ACTIVE,
        OR: [{ whiteId: userId }, { blackId: userId }],
      },
    });

    if (existingActiveGame) {
      return res.status(400).json({
        success: false,
        error: "You are already in an active game",
        data: { activeGameId: existingActiveGame.id },
        message: "Single active game constraint violation",
      });
    }

    const game = await prisma.game.create({
      data: {
        whiteId: userId,
        status: GameStatus.WAITING,
        fen: START_FEN,
      },
    });

    res.status(201).json({
      success: true,
      error: null,
      data: game,
      message: "Game created",
    });
  } catch (error) {
    console.error("Error creating game", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null,
      message: "Internal server error",
    });
  }
};

export const joinGame = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const rawGameId = req.params.gameId;
    const gameId = Array.isArray(rawGameId) ? rawGameId[0] : rawGameId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        data: null,
        message: "Unauthorized",
      });
    }

    if (!gameId) {
      return res.status(400).json({
        success: false,
        error: "Game ID is required",
        data: null,
        message: "Invalid game ID",
      });
    }

    const otherActiveGame = await prisma.game.findFirst({
      where: {
        status: GameStatus.ACTIVE,
        id: { not: gameId },
        OR: [{ whiteId: userId }, { blackId: userId }],
      },
    });

    if (otherActiveGame) {
      return res.status(400).json({
        success: false,
        error: "You are already in another active game",
        data: { activeGameId: otherActiveGame.id },
        message: "Single active game constraint violation",
      });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        error: "Game not found",
        data: null,
        message: "Game not found",
      });
    }

    let role: "white" | "black";
    let updatedGame = game;

    if (game.whiteId === userId) {
      role = "white";
    } else if (game.blackId === userId) {
      role = "black";
    } else if (!game.whiteId) {
      role = "white";
      updatedGame = await prisma.game.update({
        where: { id: gameId },
        data: { whiteId: userId },
      });
    } else if (!game.blackId) {
      role = "black";
      updatedGame = await prisma.game.update({
        where: { id: gameId },
        data: { blackId: userId, status: GameStatus.ACTIVE },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: "Game is full",
        data: null,
        message: "Game is full",
      });
    }

    if (updatedGame !== game) {
      const activeTurn: "white" | "black" =
        updatedGame.fen.split(" ")[1] === WHITE ? "white" : "black";

      gameSocketManager.broadcast(gameId, {
        type: EventType.GAME_STATE,
        gameId,
        data: {
          fen: updatedGame.fen,
          whiteId: updatedGame.whiteId,
          blackId: updatedGame.blackId,
          status: updatedGame.status,
          turn: activeTurn,
        },
      });
    }

    res.status(200).json({
      success: true,
      error: null,
      data: { game: updatedGame, role },
      message: "Joined game successfully",
    });
  } catch (error) {
    console.error("Error joining game", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null,
      message: "Internal server error",
    });
  }
};

export const getGames = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const validStatus =
      typeof status === "string" &&
      Object.values(GameStatus).includes(status as GameStatus)
        ? (status as GameStatus)
        : undefined;

    const games = await prisma.game.findMany({
      where: validStatus ? { status: validStatus } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        white: { select: { id: true, username: true } },
        black: { select: { id: true, username: true } },
      },
    });

    res.status(200).json({
      success: true,
      error: null,
      data: games,
      message: "Games fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching games", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null,
      message: "Internal server error",
    });
  }
};

export const getGameById = async (req: Request, res: Response) => {
  try {
    const rawGameId = req.params.gameId;
    const gameId = Array.isArray(rawGameId) ? rawGameId[0] : rawGameId;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        error: "Game ID is required",
        data: null,
        message: "Invalid game ID",
      });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        white: { select: { id: true, username: true } },
        black: { select: { id: true, username: true } },
        moves: { orderBy: { moveNumber: "asc" } },
      },
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        error: "Game not found",
        data: null,
        message: "Game not found",
      });
    }

    res.status(200).json({
      success: true,
      error: null,
      data: game,
      message: "Game fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching game by ID", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: null,
      message: "Internal server error",
    });
  }
};
