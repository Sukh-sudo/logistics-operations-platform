-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('CREATED', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "RouteEventType" AS ENUM (
    'ROUTE_CREATED',
    'ROUTE_UPDATED',
    'STOP_ADDED',
    'STOP_REMOVED',
    'ROUTE_ACTIVATED',
    'ROUTE_RETIRED'
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "routeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originTerminalId" INTEGER NOT NULL,
    "destinationTerminalId" INTEGER NOT NULL,
    "status" "RouteStatus" NOT NULL DEFAULT 'CREATED',
    "estimatedDistance" INTEGER NOT NULL DEFAULT 0,
    "estimatedDuration" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "terminalId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "estimatedArrivalOffset" INTEGER NOT NULL,
    "estimatedDepartureOffset" INTEGER NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteEvent" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "eventType" "RouteEventType" NOT NULL,
    "employeeId" INTEGER,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteSnapshot" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "currentStatus" "RouteStatus" NOT NULL DEFAULT 'CREATED',
    "stopCount" INTEGER NOT NULL DEFAULT 0,
    "currentStops" JSONB NOT NULL,
    "estimatedDistance" INTEGER NOT NULL DEFAULT 0,
    "estimatedDuration" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RouteSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Route_routeNumber_key" ON "Route"("routeNumber");
CREATE INDEX "Route_originTerminalId_idx" ON "Route"("originTerminalId");
CREATE INDEX "Route_destinationTerminalId_idx" ON "Route"("destinationTerminalId");
CREATE INDEX "Route_status_idx" ON "Route"("status");
CREATE UNIQUE INDEX "RouteStop_routeId_sequence_key" ON "RouteStop"("routeId", "sequence");
CREATE UNIQUE INDEX "RouteStop_routeId_terminalId_key" ON "RouteStop"("routeId", "terminalId");
CREATE INDEX "RouteStop_terminalId_idx" ON "RouteStop"("terminalId");
CREATE INDEX "RouteEvent_routeId_createdAt_idx" ON "RouteEvent"("routeId", "createdAt");
CREATE INDEX "RouteEvent_correlationId_idx" ON "RouteEvent"("correlationId");
CREATE UNIQUE INDEX "RouteSnapshot_routeId_key" ON "RouteSnapshot"("routeId");
CREATE INDEX "RouteSnapshot_currentStatus_idx" ON "RouteSnapshot"("currentStatus");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_originTerminalId_fkey" FOREIGN KEY ("originTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Route" ADD CONSTRAINT "Route_destinationTerminalId_fkey" FOREIGN KEY ("destinationTerminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteEvent" ADD CONSTRAINT "RouteEvent_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteSnapshot" ADD CONSTRAINT "RouteSnapshot_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
