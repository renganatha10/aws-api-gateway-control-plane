-- Up Migration
CREATE TABLE consumers (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  product_id      INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  environment_id  INTEGER      NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  plan_id         INTEGER      NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id       VARCHAR(255),
  aws_api_key_id  VARCHAR(255),
  token_url       VARCHAR(512),
  created_by      VARCHAR(255) NOT NULL,
  updated_by      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consumers_organisation_id ON consumers(organisation_id);

-- Down Migration
DROP TABLE consumers;
