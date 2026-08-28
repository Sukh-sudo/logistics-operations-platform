ALTER TABLE "Shipment"
ADD COLUMN "transitDays" INTEGER,
ADD COLUMN "estimatedDeliveryAt" TIMESTAMP(3);

ALTER TABLE "Shipment"
ADD CONSTRAINT "Shipment_transitDays_check"
CHECK ("transitDays" IS NULL OR "transitDays" BETWEEN 1 AND 365);
