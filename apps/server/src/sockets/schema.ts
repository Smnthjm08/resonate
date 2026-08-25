import { EventType, type ClientMessage } from "@repo/game-core";
import z from "zod";

export const clientMessageSchema: z.ZodType<ClientMessage> =
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal(EventType.GAME_JOIN),
      gameId: z.string().min(1),
    }),
    z.object({
      type: z.literal(EventType.GAME_LEAVE),
      gameId: z.string().min(1),
    }),
    z.object({
      type: z.literal(EventType.GAME_MOVE),
      gameId: z.string().min(1),
      data: z.object({
        from: z.string().min(2).max(2),
        to: z.string().min(2).max(2),
        promotion: z.string().optional(),
      }),
    }),
    z.object({
      type: z.literal(EventType.GAME_PAUSE),
      gameId: z.string().min(1),
    }),
    z.object({
      type: z.literal(EventType.GAME_RESUME),
      gameId: z.string().min(1),
    }),
  ]);
