-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'PAUSED', 'ACTIVE', 'FINISHED');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "black" TEXT,
ADD COLUMN     "status" "GameStatus" NOT NULL DEFAULT 'WAITING',
ADD COLUMN     "white" TEXT,
ADD COLUMN     "winnerId" TEXT;

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL,
    "moveNumber" INTEGER NOT NULL,
    "san" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_white_fkey" FOREIGN KEY ("white") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_black_fkey" FOREIGN KEY ("black") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
