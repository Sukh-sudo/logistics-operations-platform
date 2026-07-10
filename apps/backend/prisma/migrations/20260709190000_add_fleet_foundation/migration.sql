CREATE TYPE "TruckStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_SERVICE', 'MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'OFF_DUTY');
CREATE TYPE "FleetEventType" AS ENUM ('TRUCK_CREATED', 'DRIVER_CREATED', 'TRUCK_ASSIGNED', 'DRIVER_ASSIGNED', 'MAINTENANCE_SCHEDULED', 'MAINTENANCE_COMPLETED', 'TRUCK_OUT_OF_SERVICE', 'TRUCK_RETURNED');

CREATE TABLE "Truck" (
  "id" TEXT NOT NULL,
  "unitNumber" TEXT NOT NULL,
  "licensePlate" TEXT NOT NULL,
  "status" "TruckStatus" NOT NULL DEFAULT 'AVAILABLE',
  "terminalId" INTEGER,
  "year" INTEGER,
  "make" TEXT,
  "model" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Driver" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "licenseClass" TEXT NOT NULL,
  "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',
  "terminalId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FleetEvent" (
  "id" TEXT NOT NULL,
  "truckId" TEXT,
  "driverId" TEXT,
  "eventType" "FleetEventType" NOT NULL,
  "correlationId" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FleetEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TruckSnapshot" (
  "id" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "currentStatus" "TruckStatus" NOT NULL DEFAULT 'AVAILABLE',
  "currentTerminalId" INTEGER,
  "assignedTripId" TEXT,
  "maintenanceStatus" TEXT,
  "lastActivityAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TruckSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriverSnapshot" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "currentStatus" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',
  "currentTerminalId" INTEGER,
  "assignedTripId" TEXT,
  "lastActivityAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DriverSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Truck_unitNumber_key" ON "Truck"("unitNumber");
CREATE UNIQUE INDEX "Truck_licensePlate_key" ON "Truck"("licensePlate");
CREATE INDEX "Truck_status_idx" ON "Truck"("status");
CREATE INDEX "Truck_terminalId_idx" ON "Truck"("terminalId");
CREATE UNIQUE INDEX "Driver_employeeId_key" ON "Driver"("employeeId");
CREATE UNIQUE INDEX "Driver_licenseNumber_key" ON "Driver"("licenseNumber");
CREATE INDEX "Driver_status_idx" ON "Driver"("status");
CREATE INDEX "Driver_terminalId_idx" ON "Driver"("terminalId");
CREATE INDEX "FleetEvent_truckId_createdAt_idx" ON "FleetEvent"("truckId", "createdAt");
CREATE INDEX "FleetEvent_driverId_createdAt_idx" ON "FleetEvent"("driverId", "createdAt");
CREATE INDEX "FleetEvent_correlationId_idx" ON "FleetEvent"("correlationId");
CREATE UNIQUE INDEX "TruckSnapshot_truckId_key" ON "TruckSnapshot"("truckId");
CREATE INDEX "TruckSnapshot_currentStatus_idx" ON "TruckSnapshot"("currentStatus");
CREATE INDEX "TruckSnapshot_currentTerminalId_idx" ON "TruckSnapshot"("currentTerminalId");
CREATE UNIQUE INDEX "DriverSnapshot_driverId_key" ON "DriverSnapshot"("driverId");
CREATE INDEX "DriverSnapshot_currentStatus_idx" ON "DriverSnapshot"("currentStatus");
CREATE INDEX "DriverSnapshot_currentTerminalId_idx" ON "DriverSnapshot"("currentTerminalId");

ALTER TABLE "Truck" ADD CONSTRAINT "Truck_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FleetEvent" ADD CONSTRAINT "FleetEvent_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FleetEvent" ADD CONSTRAINT "FleetEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TruckSnapshot" ADD CONSTRAINT "TruckSnapshot_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverSnapshot" ADD CONSTRAINT "DriverSnapshot_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
