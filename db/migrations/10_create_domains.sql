-- Up Migration
CREATE TABLE domains (
  id              SERIAL PRIMARY KEY,
  organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  domain_name     VARCHAR(255) NOT NULL UNIQUE,
  certificate_arn VARCHAR(500) NOT NULL,
  aws_domain_name VARCHAR(255),
  endpoint_type   VARCHAR(20)  NOT NULL DEFAULT 'REGIONAL',
  godaddy_domain  VARCHAR(255),
  created_by      VARCHAR(255) NOT NULL,
  updated_by      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domains_organisation_id ON domains(organisation_id);

-- Down Migration
DROP TABLE domains;
