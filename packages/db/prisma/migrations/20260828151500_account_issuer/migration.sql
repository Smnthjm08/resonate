/*
  Better Auth 1.7 scopes account identity by issuer, so every account row
  carries an issuer (e.g. "local:credential") and the pair must be unique.
  See https://better-auth.com/docs/guides/1-7-upgrade-guide

  The Account table is empty at this point, so the column can be added NOT NULL
  without a backfill.
*/

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "issuer" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Account_issuer_accountId_key" ON "Account"("issuer", "accountId");
