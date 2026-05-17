-- Up Migration

CREATE TABLE apis (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  spec_type   VARCHAR(20)  NOT NULL DEFAULT 'openapi3'
                           CHECK (spec_type IN ('openapi3', 'swagger2')),
  spec        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE apis;
