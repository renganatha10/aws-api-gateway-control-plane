-- Up Migration

ALTER TABLE product_deployments ADD COLUMN updated_by VARCHAR(255);

-- Down Migration

ALTER TABLE product_deployments DROP COLUMN updated_by;
