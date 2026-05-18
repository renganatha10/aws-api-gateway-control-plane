-- Up Migration

ALTER TABLE apis ADD COLUMN base_path  VARCHAR(255);
ALTER TABLE apis ADD COLUMN updated_by VARCHAR(255);
ALTER TABLE apis ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Enforce uniqueness of base_path per gateway (ignores NULLs)
CREATE UNIQUE INDEX apis_gateway_id_base_path_unique
  ON apis (gateway_id, base_path)
  WHERE base_path IS NOT NULL AND gateway_id IS NOT NULL;

-- Down Migration

DROP INDEX IF EXISTS apis_gateway_id_base_path_unique;
ALTER TABLE apis DROP COLUMN IF EXISTS updated_at;
ALTER TABLE apis DROP COLUMN IF EXISTS updated_by;
ALTER TABLE apis DROP COLUMN IF EXISTS base_path;
