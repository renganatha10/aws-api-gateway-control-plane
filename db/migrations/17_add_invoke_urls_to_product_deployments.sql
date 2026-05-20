-- Up Migration

ALTER TABLE product_deployments
  ADD COLUMN invoke_url VARCHAR(512);

-- Down Migration

ALTER TABLE product_deployments
  DROP COLUMN invoke_url;
