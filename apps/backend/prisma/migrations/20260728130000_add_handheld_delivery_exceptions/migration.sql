-- Reserved follow-up migration. The delivery exception enum values are part of
-- the preceding handheld migration so fresh databases can create every related
-- table and enum deterministically in one step.
SELECT 1;
