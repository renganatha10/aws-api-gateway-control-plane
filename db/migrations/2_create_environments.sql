-- Up Migration

CREATE TABLE environments (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  gateway_id INTEGER      NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (gateway_id, name)
);

-- Down Migration

DROP TABLE environments;
