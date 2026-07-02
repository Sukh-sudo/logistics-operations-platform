-- CreateEnum
CREATE TYPE "TerminalStatus" AS ENUM ('ACTIVE', 'OPERATIONAL', 'MAINTENANCE', 'CLOSED');

-- CreateEnum
CREATE TYPE "TerminalEventType" AS ENUM (
    'TERMINAL_CREATED',
    'TERMINAL_UPDATED',
    'PACKAGE_RECEIVED',
    'PACKAGE_TRANSFERRED',
    'CONTAINER_RECEIVED',
    'CONTAINER_TRANSFERRED',
    'TRAILER_ARRIVED',
    'TRAILER_DEPARTED'
);

-- CreateEnum
CREATE TYPE "TerminalAssetType" AS ENUM ('PACKAGE', 'CONTAINER', 'TRAILER');

-- AlterTable
ALTER TABLE "ContainerSnapshot" ADD COLUMN "currentTerminalId" INTEGER;

-- AlterTable
ALTER TABLE "TrailerSnapshot" ADD COLUMN "currentTerminalId" INTEGER;

-- CreateTable
CREATE TABLE "Terminal" (
    "id" SERIAL NOT NULL,
    "terminalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalEvent" (
    "id" TEXT NOT NULL,
    "terminalId" INTEGER NOT NULL,
    "eventType" "TerminalEventType" NOT NULL,
    "employeeId" INTEGER,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerminalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalSnapshot" (
    "id" TEXT NOT NULL,
    "terminalId" INTEGER NOT NULL,
    "currentStatus" "TerminalStatus" NOT NULL DEFAULT 'ACTIVE',
    "packageCount" INTEGER NOT NULL DEFAULT 0,
    "containerCount" INTEGER NOT NULL DEFAULT 0,
    "trailerCount" INTEGER NOT NULL DEFAULT 0,
    "truckCount" INTEGER NOT NULL DEFAULT 0,
    "activeTripCount" INTEGER NOT NULL DEFAULT 0,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerminalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Terminal_terminalCode_key" ON "Terminal"("terminalCode");

-- CreateIndex
CREATE INDEX "TerminalEvent_terminalId_createdAt_idx" ON "TerminalEvent"("terminalId", "createdAt");

-- CreateIndex
CREATE INDEX "TerminalEvent_correlationId_idx" ON "TerminalEvent"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "TerminalSnapshot_terminalId_key" ON "TerminalSnapshot"("terminalId");

-- AddForeignKey
ALTER TABLE "TerminalEvent" ADD CONSTRAINT "TerminalEvent_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalSnapshot" ADD CONSTRAINT "TerminalSnapshot_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
