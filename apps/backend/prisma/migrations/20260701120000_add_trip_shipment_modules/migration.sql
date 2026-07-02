CREATE TYPE "TripStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TripStopStatus" AS ENUM ('PENDING', 'ARRIVED', 'DEPARTED');
CREATE TYPE "TripEventType" AS ENUM ('TRIP_CREATED', 'TRIP_UPDATED', 'TRIP_STARTED', 'STOP_ARRIVED', 'STOP_DEPARTED', 'STOP_DELAYED', 'TRIP_COMPLETED', 'TRIP_CANCELLED');
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'PACKAGES_ASSIGNED', 'IN_TRANSIT', 'PARTIALLY_DELIVERED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ShipmentEventType" AS ENUM ('SHIPMENT_CREATED', 'SHIPMENT_UPDATED', 'PACKAGE_ASSIGNED', 'PACKAGE_REMOVED', 'SHIPMENT_IN_TRANSIT', 'SHIPMENT_COMPLETED', 'SHIPMENT_CANCELLED');

CREATE TABLE "Trip" (
  "id" TEXT NOT NULL, "tripNumber" TEXT NOT NULL, "routeId" TEXT NOT NULL,
  "equipmentAssignmentId" TEXT, "status" "TripStatus" NOT NULL DEFAULT 'CREATED',
  "plannedDeparture" TIMESTAMP(3) NOT NULL, "actualDeparture" TIMESTAMP(3),
  "plannedArrival" TIMESTAMP(3) NOT NULL, "actualArrival" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TripStop" (
  "id" TEXT NOT NULL, "tripId" TEXT NOT NULL, "terminalId" INTEGER NOT NULL, "sequence" INTEGER NOT NULL,
  "plannedArrival" TIMESTAMP(3) NOT NULL, "actualArrival" TIMESTAMP(3),
  "plannedDeparture" TIMESTAMP(3) NOT NULL, "actualDeparture" TIMESTAMP(3),
  "status" "TripStopStatus" NOT NULL DEFAULT 'PENDING', "delayMinutes" INTEGER NOT NULL DEFAULT 0, "notes" TEXT,
  CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TripEvent" (
  "id" TEXT NOT NULL, "tripId" TEXT NOT NULL, "eventType" "TripEventType" NOT NULL,
  "correlationId" TEXT NOT NULL, "payload" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TripSnapshot" (
  "id" TEXT NOT NULL, "tripId" TEXT NOT NULL, "currentStatus" "TripStatus" NOT NULL DEFAULT 'CREATED',
  "currentStopId" TEXT, "nextStopId" TEXT, "currentTerminalId" INTEGER,
  "completedStops" INTEGER NOT NULL DEFAULT 0, "totalStops" INTEGER NOT NULL DEFAULT 0,
  "progressPercent" INTEGER NOT NULL DEFAULT 0, "delayMinutes" INTEGER NOT NULL DEFAULT 0,
  "lastActivityAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TripSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Shipment" (
  "id" TEXT NOT NULL, "shipmentNumber" TEXT NOT NULL, "referenceNumber" TEXT,
  "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED', "originTerminalId" INTEGER NOT NULL,
  "destinationTerminalId" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ShipmentPackage" (
  "shipmentId" TEXT NOT NULL, "packageId" TEXT NOT NULL, "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentPackage_pkey" PRIMARY KEY ("shipmentId", "packageId")
);
CREATE TABLE "ShipmentEvent" (
  "id" TEXT NOT NULL, "shipmentId" TEXT NOT NULL, "eventType" "ShipmentEventType" NOT NULL,
  "correlationId" TEXT NOT NULL, "payload" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ShipmentSnapshot" (
  "id" TEXT NOT NULL, "shipmentId" TEXT NOT NULL, "currentStatus" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
  "packageCount" INTEGER NOT NULL DEFAULT 0, "deliveredPackages" INTEGER NOT NULL DEFAULT 0,
  "remainingPackages" INTEGER NOT NULL DEFAULT 0, "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "lastActivityAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShipmentSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Trip_tripNumber_key" ON "Trip"("tripNumber");
CREATE INDEX "Trip_routeId_idx" ON "Trip"("routeId"); CREATE INDEX "Trip_status_idx" ON "Trip"("status");
CREATE UNIQUE INDEX "TripStop_tripId_sequence_key" ON "TripStop"("tripId", "sequence"); CREATE INDEX "TripStop_terminalId_idx" ON "TripStop"("terminalId");
CREATE INDEX "TripEvent_tripId_createdAt_idx" ON "TripEvent"("tripId", "createdAt"); CREATE INDEX "TripEvent_correlationId_idx" ON "TripEvent"("correlationId");
CREATE UNIQUE INDEX "TripSnapshot_tripId_key" ON "TripSnapshot"("tripId"); CREATE INDEX "TripSnapshot_currentStatus_idx" ON "TripSnapshot"("currentStatus");
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber"); CREATE INDEX "Shipment_originTerminalId_idx" ON "Shipment"("originTerminalId"); CREATE INDEX "Shipment_destinationTerminalId_idx" ON "Shipment"("destinationTerminalId"); CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");
CREATE UNIQUE INDEX "ShipmentPackage_packageId_key" ON "ShipmentPackage"("packageId");
CREATE INDEX "ShipmentEvent_shipmentId_createdAt_idx" ON "ShipmentEvent"("shipmentId", "createdAt"); CREATE INDEX "ShipmentEvent_correlationId_idx" ON "ShipmentEvent"("correlationId");
CREATE UNIQUE INDEX "ShipmentSnapshot_shipmentId_key" ON "ShipmentSnapshot"("shipmentId"); CREATE INDEX "ShipmentSnapshot_currentStatus_idx" ON "ShipmentSnapshot"("currentStatus");

ALTER TABLE "Trip" ADD CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TripEvent" ADD CONSTRAINT "TripEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TripSnapshot" ADD CONSTRAINT "TripSnapshot_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_originTerminalId_fkey" FOREIGN KEY ("originTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_destinationTerminalId_fkey" FOREIGN KEY ("destinationTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentPackage" ADD CONSTRAINT "ShipmentPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PackageSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentSnapshot" ADD CONSTRAINT "ShipmentSnapshot_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "UserEventType" ADD VALUE 'TERMINAL_ASSIGNED';
ALTER TABLE "User" ADD COLUMN "primaryTerminalId" INTEGER;
ALTER TABLE "UserSnapshot" ADD COLUMN "currentTerminalId" INTEGER;
CREATE INDEX "User_primaryTerminalId_idx" ON "User"("primaryTerminalId");
ALTER TABLE "User" ADD CONSTRAINT "User_primaryTerminalId_fkey" FOREIGN KEY ("primaryTerminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
