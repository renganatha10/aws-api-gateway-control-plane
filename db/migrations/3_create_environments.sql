-- Up Migration

CREATE TABLE environments (
  id          SERIAL       PRIMARY KEY,
  api_id      INTEGER      NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (api_id, name)
);

-- Down Migration

DROP TABLE environments;
