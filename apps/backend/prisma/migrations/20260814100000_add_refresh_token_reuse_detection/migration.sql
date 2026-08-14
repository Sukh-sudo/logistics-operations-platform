-- Each login starts an independent refresh-token family. Rotated token reuse
-- compromises only that family, while tokenVersion invalidates access tokens.
ALTER TYPE "UserEventType" ADD VALUE 'REFRESH_TOKEN_REUSE_DETECTED';

ALTER TABLE "RefreshToken"
  ADD COLUMN "familyId" TEXT,
  ADD COLUMN "rotatedAt" TIMESTAMP(3),
  ADD COLUMN "reuseDetectedAt" TIMESTAMP(3);

-- Existing sessions each become a one-token family during deployment.
UPDATE "RefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;
ALTER TABLE "RefreshToken" ALTER COLUMN "familyId" SET NOT NULL;

CREATE INDEX "RefreshToken_familyId_revokedAt_idx"
  ON "RefreshToken"("familyId", "revokedAt");
