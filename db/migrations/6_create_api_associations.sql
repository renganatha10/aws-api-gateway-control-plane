-- Up Migration
CREATE TABLE api_associations (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  api_id          INTEGER     NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  organisation_id INTEGER     NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by      VARCHAR(255) NOT NULL,
  updated_by      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, api_id)
);

CREATE INDEX idx_api_associations_organisation_id ON api_associations(organisation_id);

-- Down Migration
DROP TABLE api_associations;
