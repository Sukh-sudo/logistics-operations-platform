-- CreateEnum
CREATE TYPE "TrailerStatus" AS ENUM ('OPEN', 'CLOSED', 'IN_TRANSIT', 'ARRIVED');

-- CreateEnum
CREATE TYPE "TrailerEventType" AS ENUM ('TRAILER_CREATED', 'TRAILER_CLOSED', 'TRAILER_DEPARTED', 'TRAILER_ARRIVED');

-- CreateTable
CREATE TABLE "TrailerSnapshot" (
    "id" TEXT NOT NULL,
    "trailerBarcode" TEXT NOT NULL,
    "currentStatus" "TrailerStatus" NOT NULL,
    "containerCount" INTEGER NOT NULL DEFAULT 0,
    "packageCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrailerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrailerEvent" (
    "id" TEXT NOT NULL,
    "trailerId" TEXT NOT NULL,
    "eventType" "TrailerEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrailerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerTrailerHistory" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "trailerId" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unloadedAt" TIMESTAMP(3),

    CONSTRAINT "ContainerTrailerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageTrailerHistory" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "trailerId" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unloadedAt" TIMESTAMP(3),

    CONSTRAINT "PackageTrailerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrailerSnapshot_trailerBarcode_key" ON "TrailerSnapshot"("trailerBarcode");

-- AddForeignKey
ALTER TABLE "TrailerEvent" ADD CONSTRAINT "TrailerEvent_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "TrailerSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
