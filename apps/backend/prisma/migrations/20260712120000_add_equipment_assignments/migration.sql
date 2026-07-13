CREATE TYPE "EquipmentAssignmentStatus" AS ENUM ('ACTIVE', 'RELEASED');
ALTER TYPE "FleetEventType" ADD VALUE 'EQUIPMENT_RELEASED';

CREATE TABLE "EquipmentAssignment" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "status" "EquipmentAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EquipmentAssignment_tripId_status_idx" ON "EquipmentAssignment"("tripId", "status");
CREATE INDEX "EquipmentAssignment_truckId_status_idx" ON "EquipmentAssignment"("truckId", "status");
CREATE INDEX "EquipmentAssignment_driverId_status_idx" ON "EquipmentAssignment"("driverId", "status");
-- Partial uniqueness protects availability checks from concurrent dispatch requests.
CREATE UNIQUE INDEX "EquipmentAssignment_active_trip_key" ON "EquipmentAssignment"("tripId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "EquipmentAssignment_active_truck_key" ON "EquipmentAssignment"("truckId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "EquipmentAssignment_active_driver_key" ON "EquipmentAssignment"("driverId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "Trip_equipmentAssignmentId_key" ON "Trip"("equipmentAssignmentId");
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_equipmentAssignmentId_fkey" FOREIGN KEY ("equipmentAssignmentId") REFERENCES "EquipmentAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
