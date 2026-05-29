/*
  Warnings:

  - The values [PACKAGE_CREATED,PACKAGE_IN_TRANSIT] on the enum `PackageEventType` will be removed. If these variants are still used in the database, this will fail.
  - The values [CREATED,IN_TRANSIT] on the enum `PackageStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PackageEventType_new" AS ENUM ('PACKAGE_RECEIVED', 'PACKAGE_SORTED', 'PACKAGE_LOADED_TO_CONTAINER', 'PACKAGE_UNLOADED_FROM_CONTAINER', 'PACKAGE_LOADED_TO_TRAILER', 'PACKAGE_UNLOADED_FROM_TRAILER', 'PACKAGE_DEPARTED', 'PACKAGE_ARRIVED', 'PACKAGE_OUT_FOR_DELIVERY', 'PACKAGE_DELIVERED');
ALTER TABLE "PackageEvent" ALTER COLUMN "eventType" TYPE "PackageEventType_new" USING ("eventType"::text::"PackageEventType_new");
ALTER TYPE "PackageEventType" RENAME TO "PackageEventType_old";
ALTER TYPE "PackageEventType_new" RENAME TO "PackageEventType";
DROP TYPE "PackageEventType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PackageStatus_new" AS ENUM ('RECEIVED', 'SORTED', 'IN_CONTAINER', 'IN_TRAILER', 'DEPARTED', 'ARRIVED', 'OUT_FOR_DELIVERY', 'DELIVERED');
ALTER TABLE "PackageSnapshot" ALTER COLUMN "currentStatus" TYPE "PackageStatus_new" USING ("currentStatus"::text::"PackageStatus_new");
ALTER TYPE "PackageStatus" RENAME TO "PackageStatus_old";
ALTER TYPE "PackageStatus_new" RENAME TO "PackageStatus";
DROP TYPE "PackageStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "PackageSnapshot" ADD COLUMN     "currentContainerId" TEXT,
ADD COLUMN     "currentTrailerId" TEXT;
