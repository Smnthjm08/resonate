/*
  Warnings:

  - Added the required column `fen` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('CHECKMATE', 'RESIGNATION', 'TIMEOUT', 'STALEMATE', 'THREEFOLD_REPETITION', 'INSUFFICIENT_MATERIAL', 'FIFTY_MOVE_RULE', 'DRAW_AGREED', 'ABANDONED');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "fen" TEXT NOT NULL,
ADD COLUMN     "result" "GameResult";
