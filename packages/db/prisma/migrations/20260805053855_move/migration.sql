/*
  Warnings:

  - You are about to drop the column `black` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `white` on the `Game` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gameId,moveNumber]` on the table `Move` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_black_fkey";

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_white_fkey";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "black",
DROP COLUMN "white",
ADD COLUMN     "blackId" TEXT,
ADD COLUMN     "whiteId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Move_gameId_moveNumber_key" ON "Move"("gameId", "moveNumber");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_whiteId_fkey" FOREIGN KEY ("whiteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_blackId_fkey" FOREIGN KEY ("blackId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
