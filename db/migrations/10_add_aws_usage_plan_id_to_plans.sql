-- Up Migration

ALTER TABLE plans ADD COLUMN aws_usage_plan_id VARCHAR(100);

-- Down Migration

ALTER TABLE plans DROP COLUMN aws_usage_plan_id;
