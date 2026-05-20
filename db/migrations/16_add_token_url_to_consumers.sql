-- Up Migration

ALTER TABLE consumers
  ADD COLUMN token_url VARCHAR(512);

-- Down Migration

ALTER TABLE consumers
  DROP COLUMN token_url;
