/*
  Collapse onto Better Auth as the single auth system.

  Legacy credentials lived in "User"."password" as Bun.password hashes, which
  Better Auth cannot verify — there is no way to carry those logins over. The
  dev dataset is reset rather than partially migrated, so the auth tables start
  clean and every account is created through Better Auth from here on.
*/

-- Games and moves reference "User", and Session/Account cascade from it.
TRUNCATE TABLE "Move", "Game", "User" CASCADE;

-- AlterTable: drop the hand-rolled auth columns.
ALTER TABLE "User" DROP COLUMN "password",
DROP COLUMN "isGuest",
ADD COLUMN     "displayUsername" TEXT;

-- Better Auth always writes an email (the anonymous plugin generates a
-- placeholder one), so it is no longer nullable.
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
