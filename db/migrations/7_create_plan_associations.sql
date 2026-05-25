-- Up Migration
CREATE TABLE plan_associations (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  plan_id         INTEGER      NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by      VARCHAR(255) NOT NULL,
  updated_by      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, plan_id)
);

CREATE INDEX idx_plan_associations_organisation_id ON plan_associations(organisation_id);

-- Down Migration
DROP TABLE plan_associations;
