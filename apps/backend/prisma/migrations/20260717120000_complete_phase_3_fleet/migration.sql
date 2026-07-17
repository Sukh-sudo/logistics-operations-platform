-- Fleet execution events make IN_SERVICE and ON_TRIP snapshots rebuildable.
ALTER TYPE "FleetEventType" ADD VALUE 'TRUCK_IN_SERVICE';
ALTER TYPE "FleetEventType" ADD VALUE 'DRIVER_ON_TRIP';

-- Existing rows remain readable; all new assignments require a trailer at the API boundary.
ALTER TABLE "EquipmentAssignment" ADD COLUMN "trailerId" TEXT;
CREATE INDEX "EquipmentAssignment_trailerId_status_idx" ON "EquipmentAssignment"("trailerId", "status");
CREATE UNIQUE INDEX "EquipmentAssignment_active_trailer_key" ON "EquipmentAssignment"("trailerId") WHERE "status" = 'ACTIVE' AND "trailerId" IS NOT NULL;
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "TrailerSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
