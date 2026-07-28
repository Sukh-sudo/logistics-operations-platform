-- Handheld authentication adds a stable badge identifier without changing
-- existing password authentication.
ALTER TABLE "User" ADD COLUMN "badgeBarcode" TEXT;
CREATE UNIQUE INDEX "User_badgeBarcode_key" ON "User"("badgeBarcode");

CREATE TYPE "HandheldTaskType" AS ENUM (
  'TRAILER_LOAD', 'TRAILER_UNLOAD', 'CONTAINER_LOAD', 'CONTAINER_UNLOAD',
  'LAST_MILE_LOADING', 'COURIER_DELIVERY'
);
CREATE TYPE "HandheldSessionState" AS ENUM (
  'ACTIVE', 'PAUSED', 'INACTIVE_OFFLINE', 'COMPLETED'
);
CREATE TYPE "HandheldNetworkState" AS ENUM ('ONLINE', 'OFFLINE_NETWORK');
CREATE TYPE "HandheldSessionEventType" AS ENUM (
  'SESSION_STARTED', 'SESSION_PAUSED', 'SESSION_RESUMED', 'SESSION_COMPLETED',
  'SESSION_MARKED_INACTIVE', 'OPERATIONAL_ACTIVITY_ACCEPTED', 'CONTEXT_CHANGED'
);
CREATE TYPE "HandheldAction" AS ENUM (
  'LOAD_PACKAGE_TO_TRAILER', 'UNLOAD_PACKAGE_FROM_TRAILER',
  'LOAD_PACKAGE_TO_CONTAINER', 'UNLOAD_PACKAGE_FROM_CONTAINER',
  'LOAD_CONTAINER_TO_TRAILER', 'UNLOAD_CONTAINER_FROM_TRAILER',
  'PACKAGE_OUT_FOR_DELIVERY', 'PACKAGE_DELIVERED',
  'PACKAGE_ATTEMPTED_DELIVERY', 'PACKAGE_DAMAGED',
  'PACKAGE_MISROUTED', 'PACKAGE_RETURNED_TO_TERMINAL', 'REVERSE_EVENT'
);
ALTER TYPE "PackageStatus" ADD VALUE 'ATTEMPTED_DELIVERY';
ALTER TYPE "PackageStatus" ADD VALUE 'DAMAGED';
ALTER TYPE "PackageStatus" ADD VALUE 'MISROUTED';
ALTER TYPE "PackageStatus" ADD VALUE 'RETURNED_TO_TERMINAL';
ALTER TYPE "PackageEventType" ADD VALUE 'PACKAGE_ATTEMPTED_DELIVERY';
ALTER TYPE "PackageEventType" ADD VALUE 'PACKAGE_DAMAGED';
ALTER TYPE "PackageEventType" ADD VALUE 'PACKAGE_MISROUTED';
ALTER TYPE "PackageEventType" ADD VALUE 'PACKAGE_RETURNED_TO_TERMINAL';
CREATE TYPE "HandheldResultStatus" AS ENUM (
  'ACCEPTED', 'REJECTED', 'DUPLICATE_ACCEPTED', 'REVERSED'
);

CREATE TABLE "HandheldTaskSession" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "terminalId" INTEGER NOT NULL,
  "deviceId" TEXT NOT NULL,
  "taskType" "HandheldTaskType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandheldTaskSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HandheldTaskSessionEvent" (
  "id" TEXT NOT NULL,
  "taskSessionId" TEXT NOT NULL,
  "eventType" "HandheldSessionEventType" NOT NULL,
  "correlationId" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandheldTaskSessionEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HandheldTaskSessionSnapshot" (
  "id" TEXT NOT NULL,
  "currentState" "HandheldSessionState" NOT NULL,
  "networkState" "HandheldNetworkState" NOT NULL,
  "selectedTrailerId" TEXT,
  "selectedRouteId" TEXT,
  "selectedTruckId" TEXT,
  "lastAcceptedActivityAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HandheldTaskSessionSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HandheldTaskInterval" (
  "id" TEXT NOT NULL,
  "taskSessionId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "HandheldTaskInterval_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HandheldCommandReceipt" (
  "id" TEXT NOT NULL,
  "clientEventId" TEXT NOT NULL,
  "taskSessionId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "action" "HandheldAction" NOT NULL,
  "resultStatus" "HandheldResultStatus" NOT NULL,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceTimestamp" TIMESTAMP(3) NOT NULL,
  "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "networkStateAtCapture" "HandheldNetworkState" NOT NULL,
  "trackingNumber" TEXT,
  "containerBarcode" TEXT,
  "trailerBarcode" TEXT,
  "routeCode" TEXT,
  "truckUnitNumber" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "gpsAccuracyMetres" DECIMAL(8,2),
  "gpsCapturedAt" TIMESTAMP(3),
  "exceptionFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "domainPackageEventId" TEXT,
  "originalReceiptId" TEXT,
  "reversedAt" TIMESTAMP(3),
  CONSTRAINT "HandheldCommandReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HandheldCommandReceipt_clientEventId_key" ON "HandheldCommandReceipt"("clientEventId");
CREATE UNIQUE INDEX "HandheldCommandReceipt_domainPackageEventId_key" ON "HandheldCommandReceipt"("domainPackageEventId");
CREATE INDEX "HandheldTaskSession_employeeId_createdAt_idx" ON "HandheldTaskSession"("employeeId", "createdAt");
CREATE INDEX "HandheldTaskSession_terminalId_createdAt_idx" ON "HandheldTaskSession"("terminalId", "createdAt");
CREATE INDEX "HandheldTaskSession_deviceId_createdAt_idx" ON "HandheldTaskSession"("deviceId", "createdAt");
CREATE INDEX "HandheldTaskSessionEvent_taskSessionId_createdAt_idx" ON "HandheldTaskSessionEvent"("taskSessionId", "createdAt");
CREATE INDEX "HandheldTaskSessionEvent_correlationId_idx" ON "HandheldTaskSessionEvent"("correlationId");
CREATE INDEX "HandheldTaskSessionSnapshot_currentState_lastAcceptedActivityAt_idx" ON "HandheldTaskSessionSnapshot"("currentState", "lastAcceptedActivityAt");
CREATE INDEX "HandheldTaskInterval_taskSessionId_startedAt_idx" ON "HandheldTaskInterval"("taskSessionId", "startedAt");
CREATE INDEX "HandheldCommandReceipt_taskSessionId_serverReceivedAt_idx" ON "HandheldCommandReceipt"("taskSessionId", "serverReceivedAt");
CREATE INDEX "HandheldCommandReceipt_employeeId_serverReceivedAt_idx" ON "HandheldCommandReceipt"("employeeId", "serverReceivedAt");
CREATE INDEX "HandheldCommandReceipt_resultStatus_serverReceivedAt_idx" ON "HandheldCommandReceipt"("resultStatus", "serverReceivedAt");

ALTER TABLE "HandheldTaskSession" ADD CONSTRAINT "HandheldTaskSession_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandheldTaskSession" ADD CONSTRAINT "HandheldTaskSession_terminalId_fkey"
  FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandheldTaskSessionEvent" ADD CONSTRAINT "HandheldTaskSessionEvent_taskSessionId_fkey"
  FOREIGN KEY ("taskSessionId") REFERENCES "HandheldTaskSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandheldTaskSessionSnapshot" ADD CONSTRAINT "HandheldTaskSessionSnapshot_id_fkey"
  FOREIGN KEY ("id") REFERENCES "HandheldTaskSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HandheldTaskInterval" ADD CONSTRAINT "HandheldTaskInterval_taskSessionId_fkey"
  FOREIGN KEY ("taskSessionId") REFERENCES "HandheldTaskSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandheldCommandReceipt" ADD CONSTRAINT "HandheldCommandReceipt_taskSessionId_fkey"
  FOREIGN KEY ("taskSessionId") REFERENCES "HandheldTaskSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandheldCommandReceipt" ADD CONSTRAINT "HandheldCommandReceipt_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandheldCommandReceipt" ADD CONSTRAINT "HandheldCommandReceipt_domainPackageEventId_fkey"
  FOREIGN KEY ("domainPackageEventId") REFERENCES "PackageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HandheldCommandReceipt" ADD CONSTRAINT "HandheldCommandReceipt_originalReceiptId_fkey"
  FOREIGN KEY ("originalReceiptId") REFERENCES "HandheldCommandReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
