-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('OPEN', 'CLOSED', 'IN_TRANSIT', 'ARRIVED');

-- CreateEnum
CREATE TYPE "ContainerEventType" AS ENUM ('CONTAINER_CREATED', 'CONTAINER_CLOSED', 'CONTAINER_DEPARTED', 'CONTAINER_ARRIVED');

-- CreateTable
CREATE TABLE "ContainerSnapshot" (
    "id" TEXT NOT NULL,
    "containerBarcode" TEXT NOT NULL,
    "currentStatus" "ContainerStatus" NOT NULL,
    "currentTrailerId" TEXT,
    "packageCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContainerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerEvent" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "eventType" "ContainerEventType" NOT NULL,
    "employeeId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageContainerHistory" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unloadedAt" TIMESTAMP(3),

    CONSTRAINT "PackageContainerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContainerSnapshot_containerBarcode_key" ON "ContainerSnapshot"("containerBarcode");

-- AddForeignKey
ALTER TABLE "ContainerEvent" ADD CONSTRAINT "ContainerEvent_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ContainerSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
