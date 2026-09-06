import { prisma } from "@repo/db";

/**
 * The anonymous plugin deletes the guest row as soon as its account is linked,
 * and `Game`'s player relations are optional — Postgres nulls the guest out of
 * their own games rather than blocking the delete. Re-point the seats first so
 * the games a guest played survive the signup.
 */
export async function linkGuestGames(guestId: string, userId: string) {
  await prisma.$transaction([
    prisma.game.updateMany({
      where: { whiteId: guestId },
      data: { whiteId: userId },
    }),
    prisma.game.updateMany({
      where: { blackId: guestId },
      data: { blackId: userId },
    }),
    prisma.game.updateMany({
      where: { winnerId: guestId },
      data: { winnerId: userId },
    }),
  ]);
}
