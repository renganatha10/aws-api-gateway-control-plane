-- Up Migration

ALTER TABLE gateways ADD COLUMN aws_rest_api_id VARCHAR(100);

-- Down Migration

ALTER TABLE gateways DROP COLUMN aws_rest_api_id;
