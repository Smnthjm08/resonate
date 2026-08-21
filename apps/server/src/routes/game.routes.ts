import { START_FEN } from "@repo/game-core";
import type { Request, Response } from "express";
import { prisma } from "@repo/db";

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

    const game = await prisma.game.create({
      data: {
        whiteId: userId,
        status: "WAITING",
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
