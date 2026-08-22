/*
  Warnings:

  - Added the required column `from` to the `Move` table without a default value. This is not possible if the table is not empty.
  - Added the required column `to` to the `Move` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Move" ADD COLUMN     "from" TEXT NOT NULL,
ADD COLUMN     "promotion" TEXT,
ADD COLUMN     "to" TEXT NOT NULL;
