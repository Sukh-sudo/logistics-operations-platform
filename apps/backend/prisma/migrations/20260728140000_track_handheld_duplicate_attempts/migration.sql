-- The accepted command remains unique; this counter records transport retries
-- that replayed its result for supervisor synchronization metrics.
ALTER TABLE "HandheldCommandReceipt"
  ADD COLUMN "duplicateCount" INTEGER NOT NULL DEFAULT 0;
