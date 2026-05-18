-- Up Migration

ALTER TABLE apis ADD COLUMN display_name VARCHAR(255);
UPDATE apis SET display_name = name WHERE display_name IS NULL;
ALTER TABLE apis ALTER COLUMN display_name SET NOT NULL;

-- Down Migration

ALTER TABLE apis DROP COLUMN IF EXISTS display_name;
