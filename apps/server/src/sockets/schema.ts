import { EventType, type ClientMessage } from "@repo/game-core";
import z from "zod";

export const clientMessageSchema: z.ZodType<ClientMessage> =
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal(EventType.GAME_JOIN),
      gameId: z.string().min(1),
      data: z.object({
        userId: z.string().min(1),
      }),
    }),
    z.object({
      type: z.literal(EventType.GAME_LEAVE),
      gameId: z.string().min(1),
    }),
  ]);
