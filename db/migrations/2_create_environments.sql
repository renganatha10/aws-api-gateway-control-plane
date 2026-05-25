-- Up Migration
CREATE TABLE environments (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by      VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_environments_organisation_id ON environments(organisation_id);

-- Down Migration
DROP TABLE environments;
