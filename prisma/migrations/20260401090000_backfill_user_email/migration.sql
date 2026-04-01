-- Backfill legacy rows created before userEmail was introduced.
-- NOTE: This is safe only for a single-user dataset.
UPDATE "MenuItem"
SET "userEmail" = 'itmeetm@gmail.com'
WHERE "userEmail" IS NULL OR "userEmail" = '';
