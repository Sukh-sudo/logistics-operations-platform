-- Add the lifecycle events required when container and trailer operations
-- affect more than one aggregate.
ALTER TYPE "ContainerEventType" ADD VALUE IF NOT EXISTS 'PACKAGE_LOADED';
ALTER TYPE "ContainerEventType" ADD VALUE IF NOT EXISTS 'PACKAGE_UNLOADED';
ALTER TYPE "ContainerEventType" ADD VALUE IF NOT EXISTS 'CONTAINER_LOADED_TO_TRAILER';
ALTER TYPE "ContainerEventType" ADD VALUE IF NOT EXISTS 'CONTAINER_UNLOADED_FROM_TRAILER';

ALTER TYPE "TrailerEventType" ADD VALUE IF NOT EXISTS 'PACKAGE_LOADED_TO_TRAILER';
ALTER TYPE "TrailerEventType" ADD VALUE IF NOT EXISTS 'PACKAGE_UNLOADED_FROM_TRAILER';

ALTER TYPE "TerminalEventType" ADD VALUE IF NOT EXISTS 'TRIP_DEPARTED';
ALTER TYPE "TerminalEventType" ADD VALUE IF NOT EXISTS 'TRIP_ARRIVED';

-- Stable aggregate rows own identity. Snapshot rows remain disposable read
-- models and intentionally reuse the aggregate id to preserve existing APIs.
CREATE TABLE "Package" (
  "id" TEXT NOT NULL,
  "trackingNumber" TEXT NOT NULL,
  "packageType" "PackageType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Container" (
  "id" TEXT NOT NULL,
  "containerBarcode" TEXT NOT NULL,
  "packageType" "PackageType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trailer" (
  "id" TEXT NOT NULL,
  "trailerBarcode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Trailer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Package_trackingNumber_key" ON "Package"("trackingNumber");
CREATE UNIQUE INDEX "Container_containerBarcode_key" ON "Container"("containerBarcode");
CREATE UNIQUE INDEX "Trailer_trailerBarcode_key" ON "Trailer"("trailerBarcode");

INSERT INTO "Package" ("id", "trackingNumber", "packageType", "createdAt")
SELECT snapshot."id", snapshot."trackingNumber", snapshot."packageType",
       COALESCE(
         (SELECT MIN(event."createdAt") FROM "PackageEvent" event WHERE event."packageId" = snapshot."id"),
         snapshot."updatedAt"
       )
FROM "PackageSnapshot" snapshot;

INSERT INTO "Container" ("id", "containerBarcode", "packageType", "createdAt")
SELECT snapshot."id", snapshot."containerBarcode", snapshot."packageType",
       COALESCE(
         (SELECT MIN(event."createdAt") FROM "ContainerEvent" event WHERE event."containerId" = snapshot."id"),
         snapshot."updatedAt"
       )
FROM "ContainerSnapshot" snapshot;

INSERT INTO "Trailer" ("id", "trailerBarcode", "createdAt")
SELECT snapshot."id", snapshot."trailerBarcode",
       COALESCE(
         (SELECT MIN(event."createdAt") FROM "TrailerEvent" event WHERE event."trailerId" = snapshot."id"),
         snapshot."updatedAt"
       )
FROM "TrailerSnapshot" snapshot;

-- Backfill legacy events with a stable correlation value. New writes use the
-- request id supplied by the HTTP middleware.
ALTER TABLE "PackageEvent" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "ContainerEvent" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "TrailerEvent" ADD COLUMN "employeeId" INTEGER;
ALTER TABLE "TrailerEvent" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "TrailerEvent" ADD COLUMN "metadata" JSONB;

UPDATE "PackageEvent" SET "correlationId" = "id";
UPDATE "ContainerEvent" SET "correlationId" = "id";
UPDATE "TrailerEvent" SET "correlationId" = "id";

ALTER TABLE "PackageEvent" ALTER COLUMN "correlationId" SET NOT NULL;
ALTER TABLE "ContainerEvent" ALTER COLUMN "correlationId" SET NOT NULL;
ALTER TABLE "TrailerEvent" ALTER COLUMN "correlationId" SET NOT NULL;

-- Historical and event relationships reference stable aggregate identity,
-- never a disposable snapshot row.
ALTER TABLE "PackageEvent" DROP CONSTRAINT "PackageEvent_packageId_fkey";
ALTER TABLE "ContainerEvent" DROP CONSTRAINT "ContainerEvent_containerId_fkey";
ALTER TABLE "TrailerEvent" DROP CONSTRAINT "TrailerEvent_trailerId_fkey";
ALTER TABLE "ShipmentPackage" DROP CONSTRAINT "ShipmentPackage_packageId_fkey";
ALTER TABLE "EquipmentAssignment" DROP CONSTRAINT "EquipmentAssignment_trailerId_fkey";

ALTER TABLE "PackageEvent"
  ADD CONSTRAINT "PackageEvent_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContainerEvent"
  ADD CONSTRAINT "ContainerEvent_containerId_fkey"
  FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrailerEvent"
  ADD CONSTRAINT "TrailerEvent_trailerId_fkey"
  FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentPackage"
  ADD CONSTRAINT "ShipmentPackage_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentAssignment"
  ADD CONSTRAINT "EquipmentAssignment_trailerId_fkey"
  FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageContainerHistory"
  ADD CONSTRAINT "PackageContainerHistory_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageContainerHistory"
  ADD CONSTRAINT "PackageContainerHistory_containerId_fkey"
  FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContainerTrailerHistory"
  ADD CONSTRAINT "ContainerTrailerHistory_containerId_fkey"
  FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContainerTrailerHistory"
  ADD CONSTRAINT "ContainerTrailerHistory_trailerId_fkey"
  FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageTrailerHistory"
  ADD CONSTRAINT "PackageTrailerHistory_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageTrailerHistory"
  ADD CONSTRAINT "PackageTrailerHistory_trailerId_fkey"
  FOREIGN KEY ("trailerId") REFERENCES "Trailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageSnapshot"
  ADD CONSTRAINT "PackageSnapshot_id_fkey"
  FOREIGN KEY ("id") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContainerSnapshot"
  ADD CONSTRAINT "ContainerSnapshot_id_fkey"
  FOREIGN KEY ("id") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrailerSnapshot"
  ADD CONSTRAINT "TrailerSnapshot_id_fkey"
  FOREIGN KEY ("id") REFERENCES "Trailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PackageEvent_packageId_createdAt_idx" ON "PackageEvent"("packageId", "createdAt");
CREATE INDEX "PackageEvent_correlationId_idx" ON "PackageEvent"("correlationId");
CREATE INDEX "ContainerEvent_containerId_createdAt_idx" ON "ContainerEvent"("containerId", "createdAt");
CREATE INDEX "ContainerEvent_correlationId_idx" ON "ContainerEvent"("correlationId");
CREATE INDEX "TrailerEvent_trailerId_createdAt_idx" ON "TrailerEvent"("trailerId", "createdAt");
CREATE INDEX "TrailerEvent_correlationId_idx" ON "TrailerEvent"("correlationId");
CREATE INDEX "PackageContainerHistory_packageId_unloadedAt_idx"
  ON "PackageContainerHistory"("packageId", "unloadedAt");
CREATE INDEX "PackageContainerHistory_containerId_unloadedAt_idx"
  ON "PackageContainerHistory"("containerId", "unloadedAt");
CREATE INDEX "ContainerTrailerHistory_containerId_unloadedAt_idx"
  ON "ContainerTrailerHistory"("containerId", "unloadedAt");
CREATE INDEX "ContainerTrailerHistory_trailerId_unloadedAt_idx"
  ON "ContainerTrailerHistory"("trailerId", "unloadedAt");
CREATE INDEX "PackageTrailerHistory_packageId_unloadedAt_idx"
  ON "PackageTrailerHistory"("packageId", "unloadedAt");
CREATE INDEX "PackageTrailerHistory_trailerId_unloadedAt_idx"
  ON "PackageTrailerHistory"("trailerId", "unloadedAt");

CREATE TYPE "ProjectionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "PackageProjectionOutbox" (
  "id" TEXT NOT NULL,
  "packageEventId" TEXT NOT NULL,
  "status" "ProjectionStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackageProjectionOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackageProjectionOutbox_packageEventId_key"
  ON "PackageProjectionOutbox"("packageEventId");
CREATE INDEX "PackageProjectionOutbox_status_createdAt_idx"
  ON "PackageProjectionOutbox"("status", "createdAt");
ALTER TABLE "PackageProjectionOutbox"
  ADD CONSTRAINT "PackageProjectionOutbox_packageEventId_fkey"
  FOREIGN KEY ("packageEventId") REFERENCES "PackageEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShipmentEvent" ADD COLUMN "sourcePackageEventId" TEXT;
CREATE UNIQUE INDEX "ShipmentEvent_sourcePackageEventId_key"
  ON "ShipmentEvent"("sourcePackageEventId");
