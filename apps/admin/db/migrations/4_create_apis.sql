-- Up Migration

CREATE TABLE apis (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  scope      VARCHAR(255),
  spec_type  VARCHAR(50)  NOT NULL,
  spec       JSONB        NOT NULL,
  gateway_id INTEGER      REFERENCES gateways(id) ON DELETE SET NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE apis;
