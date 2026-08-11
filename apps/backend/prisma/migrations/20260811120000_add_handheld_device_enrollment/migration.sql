-- Managed devices add a possession proof without changing the employee's
-- badge and employee-number login criteria.
CREATE TYPE "HandheldDevicePlatform" AS ENUM ('ANDROID', 'SIMULATOR');
CREATE TYPE "HandheldDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "HandheldDeviceEventType" AS ENUM (
  'DEVICE_ENROLLED',
  'DEVICE_AUTHENTICATED',
  'DEVICE_TOKEN_REFRESHED',
  'DEVICE_REVOKED'
);

CREATE TABLE "HandheldDevice" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "credentialHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandheldDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HandheldDeviceEvent" (
  "id" TEXT NOT NULL,
  "handheldDeviceId" TEXT NOT NULL,
  "eventType" "HandheldDeviceEventType" NOT NULL,
  "actorUserId" TEXT,
  "correlationId" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandheldDeviceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HandheldDeviceSnapshot" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "platform" "HandheldDevicePlatform" NOT NULL,
  "currentStatus" "HandheldDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
  "enrolledAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastAuthenticatedAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HandheldDeviceSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RefreshToken" ADD COLUMN "handheldDeviceId" TEXT;

CREATE UNIQUE INDEX "HandheldDevice_deviceId_key" ON "HandheldDevice"("deviceId");
CREATE INDEX "HandheldDeviceEvent_handheldDeviceId_createdAt_idx" ON "HandheldDeviceEvent"("handheldDeviceId", "createdAt");
CREATE INDEX "HandheldDeviceEvent_correlationId_idx" ON "HandheldDeviceEvent"("correlationId");
CREATE UNIQUE INDEX "HandheldDeviceSnapshot_deviceId_key" ON "HandheldDeviceSnapshot"("deviceId");
CREATE INDEX "HandheldDeviceSnapshot_currentStatus_updatedAt_idx" ON "HandheldDeviceSnapshot"("currentStatus", "updatedAt");
CREATE INDEX "HandheldDeviceSnapshot_platform_currentStatus_idx" ON "HandheldDeviceSnapshot"("platform", "currentStatus");
CREATE INDEX "RefreshToken_handheldDeviceId_revokedAt_idx" ON "RefreshToken"("handheldDeviceId", "revokedAt");

ALTER TABLE "HandheldDeviceEvent" ADD CONSTRAINT "HandheldDeviceEvent_handheldDeviceId_fkey"
  FOREIGN KEY ("handheldDeviceId") REFERENCES "HandheldDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandheldDeviceSnapshot" ADD CONSTRAINT "HandheldDeviceSnapshot_id_fkey"
  FOREIGN KEY ("id") REFERENCES "HandheldDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_handheldDeviceId_fkey"
  FOREIGN KEY ("handheldDeviceId") REFERENCES "HandheldDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
