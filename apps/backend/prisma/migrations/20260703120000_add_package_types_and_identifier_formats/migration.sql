CREATE TYPE "PackageType" AS ENUM ('MAIL', 'CONVEYABLE', 'NON_CONVEYABLE', 'DANGEROUS_GOODS');

ALTER TABLE "PackageSnapshot" ADD COLUMN "packageType" "PackageType";
ALTER TABLE "ContainerSnapshot" ADD COLUMN "packageType" "PackageType";

-- Move identifiers into collision-free temporary namespaces before assigning
-- deterministic values. This also handles rows that already resemble the new format.
UPDATE "PackageSnapshot" SET "trackingNumber" = 'MIGRATED_PACKAGE_' || id;
UPDATE "ContainerSnapshot" SET "containerBarcode" = 'MIGRATED_CONTAINER_' || id;
UPDATE "TrailerSnapshot" SET "trailerBarcode" = 'MIGRATED_TRAILER_' || id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS sequence
  FROM "PackageSnapshot"
)
UPDATE "PackageSnapshot" AS package
SET "trackingNumber" = 'CON' || LPAD(numbered.sequence::text, 7, '0'),
    "packageType" = 'CONVEYABLE'
FROM numbered
WHERE package.id = numbered.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS sequence
  FROM "ContainerSnapshot"
)
UPDATE "ContainerSnapshot" AS container
SET "containerBarcode" = 'CON' || LPAD(numbered.sequence::text, 7, '0'),
    "packageType" = 'CONVEYABLE'
FROM numbered
WHERE container.id = numbered.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS sequence
  FROM "TrailerSnapshot"
)
UPDATE "TrailerSnapshot" AS trailer
SET "trailerBarcode" = 'TRLR' || LPAD(numbered.sequence::text, 6, '0')
FROM numbered
WHERE trailer.id = numbered.id;

ALTER TABLE "PackageSnapshot" ALTER COLUMN "packageType" SET NOT NULL;
ALTER TABLE "ContainerSnapshot" ALTER COLUMN "packageType" SET NOT NULL;

ALTER TABLE "PackageSnapshot" ADD CONSTRAINT "PackageSnapshot_trackingNumber_format_check"
  CHECK ("trackingNumber" ~ '^(MAIL[0-9]{6}|CON[0-9]{7}|NCON[0-9]{6}|DG[0-9]{8})$');
ALTER TABLE "ContainerSnapshot" ADD CONSTRAINT "ContainerSnapshot_containerBarcode_format_check"
  CHECK ("containerBarcode" ~ '^(MAIL[0-9]{6}|CON[0-9]{7}|NCON[0-9]{6}|DG[0-9]{8})$');
ALTER TABLE "TrailerSnapshot" ADD CONSTRAINT "TrailerSnapshot_trailerBarcode_format_check"
  CHECK ("trailerBarcode" ~ '^TRLR[0-9]{6}$');
