-- Terminal names are generated from a normalized city-specific sequence.
CREATE TABLE "TerminalNameSequence" (
    "cityKey" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT -1,

    CONSTRAINT "TerminalNameSequence_pkey" PRIMARY KEY ("cityKey")
);

-- Bring existing terminal names into the new City-000 convention. Terminal
-- IDs provide deterministic ordering within each city during migration.
WITH "rankedTerminals" AS (
    SELECT
        "id",
        "city",
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(REGEXP_REPLACE(BTRIM("city"), '\s+', ' ', 'g'))
            ORDER BY "id"
        ) - 1 AS "terminalNumber"
    FROM "Terminal"
)
UPDATE "Terminal" AS terminal
SET "name" = BTRIM(ranked."city") || '-' || LPAD(ranked."terminalNumber"::TEXT, 3, '0')
FROM "rankedTerminals" AS ranked
WHERE terminal."id" = ranked."id";

-- Continue each city's sequence after its highest migrated terminal number.
WITH "rankedTerminals" AS (
    SELECT
        LOWER(REGEXP_REPLACE(BTRIM("city"), '\s+', ' ', 'g')) AS "cityKey",
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(REGEXP_REPLACE(BTRIM("city"), '\s+', ' ', 'g'))
            ORDER BY "id"
        ) - 1 AS "terminalNumber"
    FROM "Terminal"
)
INSERT INTO "TerminalNameSequence" ("cityKey", "lastNumber")
SELECT "cityKey", MAX("terminalNumber")
FROM "rankedTerminals"
GROUP BY "cityKey";
