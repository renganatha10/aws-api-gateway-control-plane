-- Up Migration
CREATE TABLE domain_route_mappings (
  id         SERIAL PRIMARY KEY,
  domain_id  INTEGER      NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  api_id     INTEGER      NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  stage      VARCHAR(255) NOT NULL,
  base_path  VARCHAR(255) NOT NULL DEFAULT '(none)',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_domain_route_mappings_domain_id ON domain_route_mappings(domain_id);

-- Down Migration
DROP TABLE domain_route_mappings;
