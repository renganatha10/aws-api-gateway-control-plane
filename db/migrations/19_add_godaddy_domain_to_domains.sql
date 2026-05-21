-- Up Migration

ALTER TABLE domains ADD COLUMN godaddy_domain VARCHAR(255);

-- Down Migration

ALTER TABLE domains DROP COLUMN godaddy_domain;
