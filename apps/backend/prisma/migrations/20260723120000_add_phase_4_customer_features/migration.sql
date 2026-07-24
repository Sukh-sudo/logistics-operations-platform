-- Phase 4 adds customer notification routing and richer shipment projections.
ALTER TABLE "Shipment" ADD COLUMN "notificationRecipient" TEXT;

ALTER TABLE "ShipmentSnapshot"
  ADD COLUMN "currentTerminalId" INTEGER,
  ADD COLUMN "outForDeliveryPackages" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "ShipmentSnapshot_completedAt_idx" ON "ShipmentSnapshot"("completedAt");

ALTER TYPE "ShipmentEventType" ADD VALUE 'SHIPMENT_PROGRESS_UPDATED';
ALTER TYPE "ShipmentEventType" ADD VALUE 'SHIPMENT_OUT_FOR_DELIVERY';

CREATE TYPE "NotificationType" AS ENUM (
  'SHIPMENT_CREATED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'EXCEPTION'
);

CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP');

CREATE TYPE "NotificationEventType" AS ENUM (
  'NOTIFICATION_CREATED',
  'NOTIFICATION_READ',
  'NOTIFICATION_RESEND_REQUESTED'
);

CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT,
  "sourceEventId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "recipient" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationEvent" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "eventType" "NotificationEventType" NOT NULL,
  "correlationId" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationSnapshot" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "currentStatus" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
  "deliveryAttempts" INTEGER NOT NULL DEFAULT 1,
  "sentAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_sourceEventId_key" ON "Notification"("sourceEventId");
CREATE INDEX "Notification_recipient_createdAt_idx" ON "Notification"("recipient", "createdAt");
CREATE INDEX "Notification_shipmentId_createdAt_idx" ON "Notification"("shipmentId", "createdAt");
CREATE INDEX "NotificationEvent_notificationId_createdAt_idx" ON "NotificationEvent"("notificationId", "createdAt");
CREATE INDEX "NotificationEvent_correlationId_idx" ON "NotificationEvent"("correlationId");
CREATE UNIQUE INDEX "NotificationSnapshot_notificationId_key" ON "NotificationSnapshot"("notificationId");
CREATE INDEX "NotificationSnapshot_currentStatus_idx" ON "NotificationSnapshot"("currentStatus");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationEvent"
  ADD CONSTRAINT "NotificationEvent_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NotificationSnapshot"
  ADD CONSTRAINT "NotificationSnapshot_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
