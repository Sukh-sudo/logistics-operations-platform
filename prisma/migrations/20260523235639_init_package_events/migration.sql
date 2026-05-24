-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('CREATED', 'RECEIVED', 'IN_TRANSIT', 'DELIVERED');

-- CreateEnum
CREATE TYPE "PackageEventType" AS ENUM ('PACKAGE_CREATED', 'PACKAGE_RECEIVED', 'PACKAGE_IN_TRANSIT', 'PACKAGE_DELIVERED');

-- CreateTable
CREATE TABLE "PackageSnapshot" (
    "id" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "currentStatus" "PackageStatus" NOT NULL,
    "currentTerminalId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageEvent" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "eventType" "PackageEventType" NOT NULL,
    "terminalId" INTEGER,
    "employeeId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageSnapshot_trackingNumber_key" ON "PackageSnapshot"("trackingNumber");

-- AddForeignKey
ALTER TABLE "PackageEvent" ADD CONSTRAINT "PackageEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PackageSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
