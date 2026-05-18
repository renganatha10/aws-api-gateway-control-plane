-- Up Migration

CREATE TABLE plans (
  id           SERIAL       PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  gateway_id   INTEGER      NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
  throttle     INTEGER,
  burst        INTEGER,
  quota_limit  INTEGER,
  quota_period VARCHAR(10),
  created_by   VARCHAR(255) NOT NULL,
  updated_by   VARCHAR(255),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (gateway_id, name)
);

-- Down Migration

DROP TABLE plans;
