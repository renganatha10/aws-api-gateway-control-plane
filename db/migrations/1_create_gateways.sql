-- Up Migration

CREATE TABLE gateways (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(255) NOT NULL UNIQUE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE gateways;
