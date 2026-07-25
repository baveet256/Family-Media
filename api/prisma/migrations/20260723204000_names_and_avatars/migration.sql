-- AlterTable
ALTER TABLE "users" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "persons" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "persons" ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '';

-- Backfill from display_name (first token -> first_name, rest -> last_name)
UPDATE "users"
SET
  "first_name" = CASE
    WHEN trim("display_name") = '' THEN ''
    WHEN position(' ' in trim("display_name")) = 0 THEN trim("display_name")
    ELSE split_part(trim("display_name"), ' ', 1)
  END,
  "last_name" = CASE
    WHEN position(' ' in trim("display_name")) = 0 THEN ''
    ELSE trim(substr(trim("display_name"), position(' ' in trim("display_name")) + 1))
  END
WHERE "first_name" = '' AND "display_name" <> '';

UPDATE "persons"
SET
  "first_name" = CASE
    WHEN trim("display_name") = '' THEN ''
    WHEN position(' ' in trim("display_name")) = 0 THEN trim("display_name")
    ELSE split_part(trim("display_name"), ' ', 1)
  END,
  "last_name" = CASE
    WHEN position(' ' in trim("display_name")) = 0 THEN ''
    ELSE trim(substr(trim("display_name"), position(' ' in trim("display_name")) + 1))
  END
WHERE "first_name" = '' AND "display_name" <> '';
