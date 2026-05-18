-- Up Migration

ALTER TABLE gateways DROP COLUMN IF EXISTS aws_rest_api_id;

-- Down Migration

ALTER TABLE gateways ADD COLUMN aws_rest_api_id VARCHAR(100);
