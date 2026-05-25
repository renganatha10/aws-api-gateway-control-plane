-- Up Migration
CREATE TABLE apis (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  display_name    VARCHAR(255) NOT NULL,
  scope           VARCHAR(255),
  spec_type       VARCHAR(50)  NOT NULL,
  spec            JSONB        NOT NULL,
  base_path       VARCHAR(255),
  organisation_id INTEGER      REFERENCES organisations(id) ON DELETE SET NULL,
  created_by      VARCHAR(255) NOT NULL,
  updated_by      VARCHAR(255),
  aws_api_id      VARCHAR(100),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_apis_organisation_id ON apis(organisation_id);

-- Down Migration
DROP TABLE apis;
