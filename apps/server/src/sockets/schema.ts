import { EventType, type ClientMessage } from "@repo/game-core";
import z from "zod";

const gameIdOnly = <T extends ClientMessage["type"]>(type: T) =>
  z.object({
    type: z.literal(type),
    gameId: z.string().min(1),
  });

export const clientMessageSchema: z.ZodType<ClientMessage> =
  z.discriminatedUnion("type", [
    gameIdOnly(EventType.GAME_JOIN),
    gameIdOnly(EventType.GAME_LEAVE),
    z.object({
      type: z.literal(EventType.GAME_MOVE),
      gameId: z.string().min(1),
      data: z.object({
        from: z.string().min(2).max(2),
        to: z.string().min(2).max(2),
        promotion: z.string().optional(),
      }),
    }),
    gameIdOnly(EventType.GAME_PAUSE),
    gameIdOnly(EventType.GAME_RESUME),
    gameIdOnly(EventType.GAME_RESIGN),
    gameIdOnly(EventType.GAME_DRAW_OFFER),
    gameIdOnly(EventType.GAME_DRAW_ACCEPT),
    gameIdOnly(EventType.GAME_DRAW_DECLINE),
  ]);
