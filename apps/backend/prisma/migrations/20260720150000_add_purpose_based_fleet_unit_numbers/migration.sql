CREATE TYPE "TruckPurpose" AS ENUM ('LAST_MILE', 'MIDDLE_MILE');

-- Historical trucks retain their existing identifiers and have no inferred purpose.
ALTER TABLE "Truck" ADD COLUMN "purpose" "TruckPurpose";

-- A transactional counter per terminal and purpose generates the five-digit suffix.
CREATE TABLE "FleetUnitSequence" (
  "terminalId" INTEGER NOT NULL,
  "purpose" "TruckPurpose" NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FleetUnitSequence_pkey" PRIMARY KEY ("terminalId", "purpose")
);

ALTER TABLE "FleetUnitSequence"
  ADD CONSTRAINT "FleetUnitSequence_terminalId_fkey"
  FOREIGN KEY ("terminalId") REFERENCES "Terminal"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
