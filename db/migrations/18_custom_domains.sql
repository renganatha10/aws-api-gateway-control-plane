-- Up Migration

CREATE TABLE domains (
  id               SERIAL PRIMARY KEY,
  gateway_id       INTEGER NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  domain_name      VARCHAR(255) NOT NULL UNIQUE,
  certificate_arn  VARCHAR(500) NOT NULL,
  aws_domain_name  VARCHAR(255),
  endpoint_type    VARCHAR(20)  NOT NULL DEFAULT 'REGIONAL',
  created_by       VARCHAR(255) NOT NULL,
  updated_by       VARCHAR(255),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE domain_route_mappings (
  id         SERIAL PRIMARY KEY,
  domain_id  INTEGER      NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  api_id     INTEGER      NOT NULL REFERENCES apis(id)    ON DELETE CASCADE,
  stage      VARCHAR(255) NOT NULL,
  base_path  VARCHAR(255) NOT NULL DEFAULT '(none)',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Down Migration

DROP TABLE IF EXISTS domain_route_mappings;
DROP TABLE IF EXISTS domains;
