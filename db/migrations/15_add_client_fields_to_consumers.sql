-- Up Migration

ALTER TABLE consumers
  ADD COLUMN client_id      VARCHAR(255),
  ADD COLUMN aws_api_key_id VARCHAR(255);

-- Down Migration

ALTER TABLE consumers
  DROP COLUMN client_id,
  DROP COLUMN aws_api_key_id;
