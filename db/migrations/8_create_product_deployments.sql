-- Up Migration
CREATE TABLE product_deployments (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  environment_id  INTEGER      NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  status          VARCHAR(50)  NOT NULL DEFAULT 'deployed',
  invoke_url      VARCHAR(512),
  created_by      VARCHAR(255) NOT NULL,
  updated_by      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, environment_id)
);

CREATE INDEX idx_product_deployments_organisation_id ON product_deployments(organisation_id);

-- Down Migration
DROP TABLE product_deployments;
